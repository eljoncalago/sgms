/**
 * ConfirmDialog.js
 * Generic confirmation dialog used throughout the app before destructive actions.
 */
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

/**
 * @param {boolean}       open
 * @param {function}      onOpenChange   – called with true/false when dialog should open/close
 * @param {function}      onConfirm      – async callback run when the confirm button is clicked
 * @param {boolean}       [loading]      – show spinner on confirm button while request is in-flight
 * @param {string}        [title]
 * @param {string|React.Node} [description]
 * @param {string}        [confirmText]  – label for the destructive button (default: "Confirm")
 * @param {string}        [cancelText]   – label for the cancel button  (default: "Cancel")
 */
export const ConfirmDialog = ({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
  title = 'Are you sure?',
  description = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <DialogFooter className="gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={loading}
        >
          {cancelText}
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={onConfirm}
          disabled={loading}
        >
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {confirmText}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
