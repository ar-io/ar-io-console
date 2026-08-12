import BaseModal from './BaseModal';

interface BlockingMessageModalProps {
  message: string;
  onClose: () => void;
}

export default function BlockingMessageModal({ message, onClose }: BlockingMessageModalProps) {
  return (
    // dismissible={false}: this is the wallet-connection spinner, shown while an
    // operation is in flight. Escape and backdrop-click must not cancel it out
    // from under the caller — the same reason it already hides the close button.
    <BaseModal onClose={onClose} showCloseButton={false} dismissible={false}>
      <div className="flex w-[24.5rem] max-w-full flex-col items-center justify-center p-8">
        <div className="flex size-[4.5rem] items-center justify-center pb-4">
          <img
            src={`${import.meta.env.BASE_URL}brand/ario-token-logo.svg`}
            alt="Loading"
            className="w-16 h-16 animate-spin"
            style={{ animationDuration: '2s' }}
          />
        </div>
        <div className="text-foreground text-sm text-center">{message}</div>
      </div>
    </BaseModal>
  );
}