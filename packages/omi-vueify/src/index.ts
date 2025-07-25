import { h, defineComponent, ref, onMounted, onBeforeUnmount, computed } from 'vue';

export function omiVueify(
  tagName: string,
  options: {
    methodNames: string[]
  },
) {
  return defineComponent({
    name: tagName,
    inheritAttrs: false,

    setup(props, { emit, attrs, slots, expose }) {
      const elRef = ref<HTMLElement | null>(null);

      // methodNames 改成调用 elRef.value[methodName]
      const { methodNames } = options;
      const methods = {};
      methodNames.forEach((methodName) => {
        // @ts-ignore
        methods[methodName] = (...args: any[]) => {
          if (elRef.value) {
            // @ts-ignore
            return elRef.value[methodName]?.(...args);
          }
        };
      });

      expose(methods);

      // 处理属性命名规则
      const formatAttrs = computed(() =>
        Object.fromEntries(
          Object.entries(attrs)
            // 仅处理非事件
            .filter(([key]) => !key.match(/^on[A-Za-z]/))
            .map(([key, value]) => {
              // 复杂类型 转驼峰
              if (value && typeof value === 'object') {
                return [kebabToCamel(key), value];
              }
              // 基本数据类型 转kebab-case
              return [camelToKebab(key), value];
            }),
        ),
      );

      // 处理事件监听
      const omiEvents = Object.keys(attrs)
        .filter(attrKey => attrKey.match(/^on[A-Za-z]/))
        .map(oriEvent => oriEventToOmi(oriEvent));

      onMounted(() => {
        // 添加事件监听
        omiEvents.forEach((omiEvent) => {
          const vueEvent = camelToKebab(omiEvent);
          // 仅处理kebab-case风格
          if (!isKebabString(vueEvent)) return;

          elRef.value?.addEventListener(omiEvent, (e: Event) => {
            emit(vueEvent, e);
          })
        })
      })

      // 清理事件监听
      onBeforeUnmount(() => {
        omiEvents.forEach((omiEvent) => {
          elRef.value?.removeEventListener(omiEvent, () => {})
        })
      })

      return () => {
        // 收集所有 slot vnode
        const children = [];

        // 默认 slot
        if (slots.default) {
          children.push(...slots.default());
        }

        // 具名 slot
        Object.keys(slots).forEach((key) => {
          if (key === 'default') return;
          const vnodes = slots[key]?.();
          // 给每个 vnode 添加 slot 属性
          if (vnodes) {
            vnodes.forEach((vnode) => {
              // 兼容 Fragment
              if (Array.isArray(vnode)) {
                vnode.forEach((vn) => {
                  if (vn && typeof vn === 'object') {
                    vn.props = { ...(vn.props || {}), slot: key };
                  }
                });
              } else if (vnode && typeof vnode === 'object') {
                vnode.props = { ...(vnode.props || {}), slot: key };
              }
              children.push(vnode);
            });
          }
        });

        return h(
          tagName,
          {
            ref: elRef,
            ...props,
            ...formatAttrs.value,
          },
          children
        );
      };
    },
  });
}

/*
 * oriEvent -> omiEvent:
 * 示例：onFileSelect -> fileSelect
 */
const oriEventToOmi = (oriEvent: string): string => {
  const eventName = oriEvent.slice(2);
  return eventName[0].toLowerCase() + eventName.slice(1);
}

/**
 * 判断字符串是否是连字符风格
 */
const isKebabString = (v: string): boolean => {
  return v.includes('-');
}

/*
 * 驼峰转kebab-case
 * 示例：fileSelectAaa -> file-select-aaa
 */
const camelToKebab = (omiEvent: string): string => {
  return omiEvent.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * kebab-case转驼峰
 * 示例：file-select-aaa -> fileSelectAaa
 */
const kebabToCamel = (str: string): string => {
  return str.replace(/-([a-z])/g, (_match, p1) => p1.toUpperCase());
}
