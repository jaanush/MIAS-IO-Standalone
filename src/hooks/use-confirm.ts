import { useState, useCallback } from "react";

type ConfirmState = {
  open: boolean;
  description: string;
  onConfirm: () => void;
};

/**
 * Hook for managing confirm dialog state.
 *
 * Usage:
 *   const [confirmProps, confirm] = useConfirm();
 *   confirm("Delete this item?", () => deleteMutation.mutate({ id }));
 *   <ConfirmDialog {...confirmProps} />
 */
export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    description: "",
    onConfirm: () => {},
  });

  const confirm = useCallback((description: string, onConfirm: () => void) => {
    setState({ open: true, description, onConfirm });
  }, []);

  const props = {
    open: state.open,
    description: state.description,
    onConfirm: () => {
      state.onConfirm();
      setState((s) => ({ ...s, open: false }));
    },
    onCancel: () => setState((s) => ({ ...s, open: false })),
  };

  return [props, confirm] as const;
}
