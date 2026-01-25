import * as React from 'react';
import { Switch as BaseSwitch } from '@base-ui/react';
import { cn } from '@/lib/utils';

/**
 * Switch 开关组件
 * 基于 Base UI Switch 封装，用于布尔值切换
 */
const Switch = React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<typeof BaseSwitch.Root>>(
  ({ className, ...props }, ref) => (
    <BaseSwitch.Root
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-checked:bg-[#81C995] data-unchecked:bg-input',
        className,
      )}
      {...props}
      ref={ref}
    >
      <BaseSwitch.Thumb
        className={cn(
          'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-checked:translate-x-4 data-unchecked:translate-x-0',
        )}
      />
    </BaseSwitch.Root>
  ),
);
Switch.displayName = 'Switch';

export { Switch };
