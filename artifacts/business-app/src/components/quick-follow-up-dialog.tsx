import { useListCustomers } from "@workspace/api-client-react";
import { CustomerAutocomplete } from "@/components/customer-autocomplete";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function QuickFollowUpDialog({ onClose, onSelectCustomer }: {
  onClose: () => void;
  onSelectCustomer: (customerId: string) => void;
}) {
  const customers = useListCustomers();

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Follow-Up</DialogTitle>
          <DialogDescription>Choose a customer to create a follow-up without booking a job.</DialogDescription>
        </DialogHeader>
        {customers.isPending ? (
          <p className="text-sm text-muted-foreground">Loading customers...</p>
        ) : customers.isError ? (
          <div className="space-y-3">
            <p className="text-sm text-destructive">Unable to load customers.</p>
            <Button type="button" variant="outline" onClick={() => void customers.refetch()}>Retry</Button>
          </div>
        ) : (
          <>
            {customers.data.length ? (
              <CustomerAutocomplete customers={customers.data} onSelect={onSelectCustomer} />
            ) : (
              <p className="text-sm text-muted-foreground">Add a customer first to create a follow-up.</p>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
