"use client";

import { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export interface ConfirmConfig {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ config }: { config: ConfirmConfig }) {
  const danger = config.tone === "danger";
  return (
    <Dialog open={config.open} onOpenChange={(v) => !v && config.onCancel()}>
      <DialogContent className="max-w-md border-slate-200">
        <DialogHeader>
          <div className="flex items-start gap-3">
            {danger && (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <AlertTriangle className="h-4.5 w-4.5 h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <DialogTitle className="text-slate-900">{config.title}</DialogTitle>
              <DialogDescription className="mt-1 text-slate-500">
                {config.description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="pt-2">
          <Button
            variant="outline"
            onClick={config.onCancel}
            className="border-slate-200"
          >
            {config.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            onClick={config.onConfirm}
            className={
              danger
                ? "bg-rose-600 text-white hover:bg-rose-700"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }
          >
            {config.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
