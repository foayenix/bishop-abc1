import { ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'important' | 'finance' | 'promo' | 'social' | 'personal' | 'success' | 'warning'
  className?: string
}

const variantStyles = {
  default: 'bg-gray-100 text-gray-700',
  important: 'bg-red-100 text-red-700',
  finance: 'bg-green-100 text-green-700',
  promo: 'bg-purple-100 text-purple-700',
  social: 'bg-blue-100 text-blue-700',
  personal: 'bg-yellow-100 text-yellow-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-orange-100 text-orange-700',
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  )
}

export function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null

  const isValidVariant = category in variantStyles
  const variant = isValidVariant ? (category as BadgeProps['variant']) : 'default'

  return (
    <Badge variant={variant}>
      {category.charAt(0).toUpperCase() + category.slice(1)}
    </Badge>
  )
}
