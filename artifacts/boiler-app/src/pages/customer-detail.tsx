import { useGetCustomer } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, Phone, Mail, MapPin, Edit, ArrowLeft, Plus } from "lucide-react";

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: customer, isLoading } = useGetCustomer(id);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!customer) return <div>Customer not found</div>;

  return (
    <div className="space-y-6 animate-in fade-in">
      <Link href="/customers" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Customers
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-display font-bold text-2xl">
            {customer.first_name[0]}{customer.last_name[0]}
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              {customer.title ? `${customer.title} ` : ''}{customer.first_name} {customer.last_name}
            </h1>
            <p className="text-muted-foreground mt-1">Customer since {new Date(customer.created_at).getFullYear()}</p>
          </div>
        </div>
        <Button variant="outline">
          <Edit className="w-4 h-4 mr-2" /> Edit Details
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-1 border border-border/50 shadow-sm space-y-4">
          <h3 className="font-bold text-lg border-b border-border/50 pb-2">Contact Info</h3>
          
          {customer.phone && (
            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Phone</p>
                <p className="text-foreground">{customer.phone}</p>
              </div>
            </div>
          )}
          
          {customer.email && (
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-foreground">{customer.email}</p>
              </div>
            </div>
          )}

          {(customer.address_line1 || customer.postcode) && (
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Billing Address</p>
                <p className="text-foreground text-sm leading-relaxed">
                  {customer.address_line1}<br/>
                  {customer.address_line2 && <>{customer.address_line2}<br/></>}
                  {customer.city}{customer.city && customer.postcode ? ', ' : ''}{customer.postcode}
                </p>
              </div>
            </div>
          )}
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-display font-bold">Properties</h2>
            <Button size="sm" variant="secondary"><Plus className="w-4 h-4 mr-2"/> Add Property</Button>
          </div>
          
          {customer.properties?.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <Home className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-muted-foreground">No properties linked to this customer.</p>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {customer.properties?.map(prop => (
                <Link key={prop.id} href={`/properties/${prop.id}`}>
                  <Card className="p-5 border border-border/50 hover:border-primary/50 transition-colors cursor-pointer">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                        <Home className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{prop.address_line1}</p>
                        <p className="text-sm text-muted-foreground">{prop.postcode}</p>
                        <span className="inline-block mt-2 text-xs font-medium bg-slate-100 px-2 py-1 rounded-md text-slate-600 capitalize">
                          {prop.property_type || 'Property'}
                        </span>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
