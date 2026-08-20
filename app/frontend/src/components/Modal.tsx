import { Modal as MantineModal, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'

export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
}) {
  return (
    <MantineModal
      opened
      onClose={onClose}
      size={wide ? 'min(1000px, calc(100vw - 32px))' : 570}
      title={
        <div className="modal-title">
          <Title order={2}>{title}</Title>
          {subtitle && <Text>{subtitle}</Text>}
        </div>
      }
      overlayProps={{ backgroundOpacity: 0.52, blur: 2 }}
      classNames={{ content: 'cw-modal', header: 'cw-modal-header', body: 'cw-modal-body' }}
      closeButtonProps={{ 'aria-label': 'Close' }}
    >
      {children}
    </MantineModal>
  )
}
