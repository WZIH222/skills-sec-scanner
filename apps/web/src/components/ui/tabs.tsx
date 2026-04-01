'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

const TabsContext = React.createContext<{
  value: string
  onValueChange: (value: string) => void
}>({
  value: '',
  onValueChange: () => {},
})

interface TabsProps {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  className?: string
}

export function Tabs({ defaultValue = '', value: controlledValue, onValueChange, children, className }: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue || controlledValue || '')
  const value = controlledValue ?? uncontrolledValue
  const onValueChangeControlled = (val: string) => {
    onValueChange?.(val)
    if (controlledValue === undefined) {
      setUncontrolledValue(val)
    }
  }

  return (
    <TabsContext.Provider value={{ value, onValueChange: onValueChangeControlled }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

interface TabsListProps {
  children: React.ReactNode
  className?: string
}

export function TabsList({ children, className }: TabsListProps) {
  const { value } = React.useContext(TabsContext)

  return (
    <div
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
        className
      )}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, { currentValue: value } as any)
        }
        return child
      })}
    </div>
  )
}

interface TabsTriggerProps {
  value: string
  children: React.ReactNode
  className?: string
  currentValue?: string
}

export function TabsTrigger({ value, children, className, currentValue }: TabsTriggerProps) {
  const context = React.useContext(TabsContext)
  const isActive = currentValue === value || context.value === value

  return (
    <button
      type="button"
      onClick={() => context.onValueChange(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        isActive
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-background/50',
        className
      )}
    >
      {children}
    </button>
  )
}

interface TabsContentProps {
  value: string
  children: React.ReactNode
  className?: string
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const context = React.useContext(TabsContext)

  if (context.value !== value) {
    return null
  }

  return (
    <div className={cn('mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2', className)}>
      {children}
    </div>
  )
}
