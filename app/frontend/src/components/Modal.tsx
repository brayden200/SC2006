import { Modal as MantineModal, Text, Title } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import type { ReactNode } from 'react'

export function Modal({
  title,
  subtitle,
  children,
  onClose,
  mobileFullScreen = false,
  bodyClassName,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  onClose: () => void
  mobileFullScreen?: boolean
  bodyClassName?: string
}) {
  const isMobile = useMediaQuery('(max-width: 620px)')

  return (
    <MantineModal
      opened
      onClose={onClose}
      fullScreen={mobileFullScreen && isMobile}
      size={570}
      title={
        <div className="modal-title">
          <Title order={2}>{title}</Title>
          {subtitle && <Text>{subtitle}</Text>}
        </div>
      }
      overlayProps={{ backgroundOpacity: 0.52, blur: 2 }}
      classNames={{
        content: 'cw-modal',
        header: 'cw-modal-header',
        body: ['cw-modal-body', bodyClassName].filter(Boolean).join(' '),
      }}
      closeButtonProps={{ 'aria-label': 'Close' }}
    >
      {children}
    </MantineModal>
  )
}
