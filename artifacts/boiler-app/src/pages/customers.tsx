import { useState } from "react";
import { useListCustomers, useCreateCustomer } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { Search, Plus, MapPin, Phone, Mail } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";

export default function Customers() {
  const [search, setSearch] = useState("");
  const { data: customers, isLoading } = useListCustomers({ search: search || undefined });
  const [isAdding, setIsAdding] = useState(false);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Customers</h1>
          <p className="text-muted-foreground mt-1">Manage your customer database</p>
        </div>
        <Button onClick={() => setIsAdding(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add Customer
        </Button>
      </div>

      <div className="flex items-center relative max-w-md">
        <Search className="w-5 h-5 absolute left-3 text-muted-foreground" />
        <Input 
          placeholder="Search customers..." 
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isAdding && <AddCustomerForm onClose={() => setIsAdding(false)} />}

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers?.map(customer => (
            <Link key={customer.id} href={`/customers/${customer.id}`}>
              <Card className="p-5 border border-border/50 shadow-sm hover:shadow-md hover:border-primary/30 transition-all h-full flex flex-col cursor-pointer">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                    {customer.first_name[0]}{customer.last_name[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-lg leading-tight">
                      {customer.first_name} {customer.last_name}
                    </h3>
                  </div>
                </div>
                
                <div className="space-y-2 mt-auto text-sm text-muted-foreground">
                  {customer.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" /> {customer.phone}
                    </div>
                  )}
                  {customer.email && (
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="w-4 h-4 shrink-0" /> <span className="truncate">{customer.email}</span>
                    </div>
                  )}
                  {customer.postcode && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" /> {customer.postcode}
                    </div>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function AddCustomerForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const create = useCreateCustomer();
  const { register, handleSubmit } = useForm();
  const { toast } = useToast();

  const onSubmit = async (data: Record<string, unknown>) => {
    try {
      await create.mutateAsync({ data: data as { first_name: string; last_name: string } });
      qc.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Customer saved", description: `${data.first_name} ${data.last_name} has been added.` });
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save customer. Please try again.";
      toast({ title: "Failed to save customer", description: message, variant: "destructive" });
    }
  };

  return (
    <Card className="p-6 border-primary/20 shadow-lg bg-primary/5 mb-6">
      <h3 className="font-bold text-lg mb-4">Add New Customer</h3>
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input placeholder="First Name" required {...register("first_name")} />
        <Input placeholder="Last Name" required {...register("last_name")} />
        <Input placeholder="Email" type="email" {...register("email")} />
        <Input placeholder="Phone" {...register("phone")} />
        <Input placeholder="Address Line 1" className="md:col-span-2" {...register("address_line1")} />
        <Input placeholder="City" {...register("city")} />
        <Input placeholder="Postcode" {...register("postcode")} />
        <div className="md:col-span-2 flex justify-end gap-2 mt-2">
          <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={create.isPending}>Save Customer</Button>
        </div>
      </form>
    </Card>
  );
}
