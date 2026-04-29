import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

function isInsufficientCreditsMessage(message: string) {
  return message.toLowerCase().includes('insufficient credits');
}

export function showErrorToast(message: string) {
  if (isInsufficientCreditsMessage(message)) {
    toast.error(message, {
      className: 'insufficient-credits-toast',
      icon: <AlertCircle className="h-4 w-4 text-red-600" />,
    });
    return;
  }

  toast.error(message);
}
