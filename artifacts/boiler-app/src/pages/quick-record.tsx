import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useListCustomers, useListProperties } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Zap, ChevronRight, ChevronLeft, Users, Home, Flame,
  FileText, Wrench, ClipboardCheck, Droplets, ShieldAlert,
  Gauge, Settings, ShieldCheck as ShieldCheckIcon, Pipette, ClipboardList, Wind,
  Plus, X
} from "lucide-react";
import { usePlanFeatures } from "@/hooks/use-plan-features";

interface Appliance {
  id: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  property_id: string;
}

const FORM_TYPES = [
  { key: "service-record", label: "Service Record", icon: FileText, color: "blue", description: "Complete full inspection", feature: null },
  { key: "breakdown-report", label: "Breakdown Report", icon: Wrench, color: "rose", description: "Record faults and fixes", feature: null },
  { key: "commissioning", label: "Commissioning Record", icon: ClipboardCheck, color: "emerald", description: "New installation commissioning", feature: "commissioning_forms" },
  { key: "job-completion", label: "Job Completion Report", icon: ClipboardList, color: "emerald", description: "Summarise work & sign-off", feature: null },
  { key: "oil-tank-inspection", label: "Oil Tank Inspection", icon: Droplets, color: "blue", description: "Tank details & condition", feature: "oil_tank_forms" },
  { key: "oil-tank-risk-assessment", label: "Oil Tank Risk Assessment", icon: ShieldAlert, color: "orange", description: "Hazards & risk ratings", feature: "oil_tank_forms" },
  { key: "combustion-analysis", label: "Combustion Analysis", icon: Gauge, color: "indigo", description: "Flue gas readings & efficiency", feature: "combustion_analysis" },
  { key: "burner-setup", label: "Burner Setup Record", icon: Settings, color: "amber", description: "Nozzle, pressure & electrodes", feature: "oil_tank_forms" },
  { key: "fire-valve-test", label: "Fire Valve Test", icon: ShieldCheckIcon, color: "red", description: "Test result & remedial action", feature: "oil_tank_forms" },
  { key: "oil-line-vacuum-test", label: "Oil Line Vacuum Test", icon: Pipette, color: "teal", description: "Pipework & vacuum readings", feature: "oil_tank_forms" },
  { key: "heat-pump-service", label: "Heat Pump Service", icon: Wind, color: "cyan", description: "Refrigerant, temps & COP readings", feature: "heat_pump_forms" },
  { key: "heat-pump-commissioning", label: "Heat Pump Commissioning", icon: ClipboardCheck, color: "cyan", description: "MCS-style commissioning record", feature: "heat_pump_forms" },
];

function InlineCreateCustomer({ onCreated, onCancel }: { onCreated: (id: string) => void; onCancel: () => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleCreate = async () => {
    if (!firstName.trim() || !lastName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ first_name: firstName.trim(), last_name: lastName.trim(), phone: phone.trim() || undefined, email: email.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create customer");
      }
      const customer = await res.json();
      await queryClient.invalidateQueries({ queryKey: ["listCustomers"] });
      toast({ title: "Customer created" });
      onCreated(customer.id);
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-2 border-dashed border-primary/30 rounded-lg p-4 space-y-3 bg-primary/5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-1"><Plus className="w-4 h-4" /> New Customer</h3>
        <Button variant="ghost" size="sm" onClick={onCancel}><X className="w-4 h-4" /></Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">First Name *</Label>
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" />
        </div>
        <div>
          <Label className="text-xs">Last Name *</Label>
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Smith" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07123 456789" />
        </div>
        <div>
          <Label className="text-xs">Email</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" />
        </div>
      </div>
      <Button onClick={handleCreate} disabled={!firstName.trim() || !lastName.trim() || saving} size="sm" className="w-full">
        {saving ? "Creating..." : "Create Customer"}
      </Button>
    </div>
  );
}

function InlineCreateProperty({ customerId, onCreated, onCancel }: { customerId: string; onCreated: (id: string) => void; onCancel: () => void }) {
  const [addressLine1, setAddressLine1] = useState("");
  const [postcode, setPostcode] = useState("");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleCreate = async () => {
    if (!addressLine1.trim() || !postcode.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/properties`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ customer_id: customerId, address_line1: addressLine1.trim(), postcode: postcode.trim(), city: city.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create property");
      }
      const property = await res.json();
      await queryClient.invalidateQueries({ queryKey: ["listProperties"] });
      toast({ title: "Property created" });
      onCreated(property.id);
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-2 border-dashed border-primary/30 rounded-lg p-4 space-y-3 bg-primary/5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-1"><Plus className="w-4 h-4" /> New Property</h3>
        <Button variant="ghost" size="sm" onClick={onCancel}><X className="w-4 h-4" /></Button>
      </div>
      <div>
        <Label className="text-xs">Address *</Label>
        <Input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} placeholder="123 High Street" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">City</Label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="London" />
        </div>
        <div>
          <Label className="text-xs">Postcode *</Label>
          <Input value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="SW1A 1AA" />
        </div>
      </div>
      <Button onClick={handleCreate} disabled={!addressLine1.trim() || !postcode.trim() || saving} size="sm" className="w-full">
        {saving ? "Creating..." : "Create Property"}
      </Button>
    </div>
  );
}

export default function QuickRecord() {
  const [step, setStep] = useState(0);
  const [customerId, setCustomerId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [applianceId, setApplianceId] = useState("");
  const [formType, setFormType] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [showCreateProperty, setShowCreateProperty] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { hasFeature, isLoading: planLoading } = usePlanFeatures();

  const availableFormTypes = FORM_TYPES.filter(
    (f) => !f.feature || hasFeature(f.feature)
  );

  const { data: customers } = useListCustomers();
  const { data: properties } = useListProperties();
  const { data: appliances } = useQuery<Appliance[]>({
    queryKey: ["appliances-for-property", propertyId],
    queryFn: async () => {
      if (!propertyId) return [];
      const res = await fetch(`/api/appliances?property_id=${propertyId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!propertyId,
  });

  const filteredCustomers = customers?.filter((c) => {
    if (!searchTerm) return true;
    const name = `${c.first_name} ${c.last_name}`.toLowerCase();
    return name.includes(searchTerm.toLowerCase());
  });

  const filteredProperties = properties?.filter(
    (p) => !customerId || p.customer_id === customerId
  );

  const selectedCustomer = customers?.find((c) => c.id === customerId);
  const selectedProperty = properties?.find((p) => p.id === propertyId);

  const handleSubmit = async () => {
    if (!customerId || !propertyId || !formType) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/quick-record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          customer_id: customerId,
          property_id: propertyId,
          appliance_id: applianceId || undefined,
          form_type: formType,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create record");
      }
      const { form_url } = await res.json();
      toast({ title: "Record created", description: "Navigating to form..." });
      navigate(form_url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const steps = [
    { label: "Customer", icon: Users },
    { label: "Property", icon: Home },
    { label: "Appliance", icon: Flame },
    { label: "Form Type", icon: FileText },
  ];

  const canProceed = () => {
    if (step === 0) return !!customerId;
    if (step === 1) return !!propertyId;
    if (step === 2) return true;
    if (step === 3) return !!formType;
    return false;
  };

  return (
    <div className="space-y-6 animate-in fade-in max-w-2xl mx-auto">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Zap className="w-4 h-4" />
          Quick Record
        </div>
        <h1 className="text-3xl font-display font-bold">Start a New Record</h1>
        <p className="text-muted-foreground mt-1">Pick a customer, property, and form type to get started</p>
      </div>

      <div className="flex items-center justify-center gap-2 mb-6">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
              i < step ? "bg-primary text-white" :
              i === step ? "bg-primary/20 text-primary ring-2 ring-primary" :
              "bg-slate-100 text-slate-400"
            }`}>
              {i + 1}
            </div>
            <span className={`text-sm hidden sm:inline ${i === step ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
              {s.label}
            </span>
            {i < steps.length - 1 && <ChevronRight className="w-4 h-4 text-slate-300" />}
          </div>
        ))}
      </div>

      <Card className="p-6">
        {step === 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2"><Users className="w-5 h-5" /> Select Customer</h2>
              {!showCreateCustomer && (
                <Button variant="outline" size="sm" onClick={() => setShowCreateCustomer(true)}>
                  <Plus className="w-4 h-4 mr-1" /> New
                </Button>
              )}
            </div>
            {showCreateCustomer && (
              <InlineCreateCustomer
                onCreated={(id) => {
                  setCustomerId(id);
                  setPropertyId("");
                  setApplianceId("");
                  setShowCreateCustomer(false);
                }}
                onCancel={() => setShowCreateCustomer(false)}
              />
            )}
            <Input
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="max-h-64 overflow-y-auto space-y-1">
              {filteredCustomers?.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setCustomerId(c.id); setPropertyId(""); setApplianceId(""); }}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    customerId === c.id
                      ? "bg-primary/10 border border-primary/30 text-primary font-semibold"
                      : "hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  <p className="font-medium">{c.first_name} {c.last_name}</p>
                  {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                </button>
              ))}
              {filteredCustomers?.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No customers found</p>
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2"><Home className="w-5 h-5" /> Select Property</h2>
              {!showCreateProperty && (
                <Button variant="outline" size="sm" onClick={() => setShowCreateProperty(true)}>
                  <Plus className="w-4 h-4 mr-1" /> New
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Showing properties for <span className="font-semibold text-foreground">{selectedCustomer?.first_name} {selectedCustomer?.last_name}</span>
            </p>
            {showCreateProperty && (
              <InlineCreateProperty
                customerId={customerId}
                onCreated={(id) => {
                  setPropertyId(id);
                  setApplianceId("");
                  setShowCreateProperty(false);
                }}
                onCancel={() => setShowCreateProperty(false)}
              />
            )}
            <div className="max-h-64 overflow-y-auto space-y-1">
              {filteredProperties?.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setPropertyId(p.id); setApplianceId(""); }}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    propertyId === p.id
                      ? "bg-primary/10 border border-primary/30 text-primary font-semibold"
                      : "hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  <p className="font-medium">{p.address_line1}</p>
                  <p className="text-xs text-muted-foreground">{p.postcode}</p>
                </button>
              ))}
              {filteredProperties?.length === 0 && !showCreateProperty && (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">No properties for this customer</p>
                  <Button variant="link" size="sm" onClick={() => setShowCreateProperty(true)} className="mt-1">
                    <Plus className="w-3 h-3 mr-1" /> Add one now
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2"><Flame className="w-5 h-5" /> Select Appliance (Optional)</h2>
            <p className="text-sm text-muted-foreground">
              Property: <span className="font-semibold text-foreground">{selectedProperty?.address_line1}</span>
            </p>
            <div className="max-h-64 overflow-y-auto space-y-1">
              <button
                onClick={() => setApplianceId("")}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                  !applianceId
                    ? "bg-primary/10 border border-primary/30 text-primary font-semibold"
                    : "hover:bg-slate-50 border border-transparent"
                }`}
              >
                <p className="font-medium">No appliance / General</p>
              </button>
              {appliances?.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setApplianceId(a.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    applianceId === a.id
                      ? "bg-primary/10 border border-primary/30 text-primary font-semibold"
                      : "hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  <p className="font-medium">{a.manufacturer} {a.model}</p>
                  <p className="text-xs text-muted-foreground font-mono">SN: {a.serial_number}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2"><FileText className="w-5 h-5" /> Select Form Type</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {availableFormTypes.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFormType(f.key)}
                  className={`text-left px-4 py-3 rounded-lg transition-all flex items-center gap-3 ${
                    formType === f.key
                      ? "bg-primary/10 border-2 border-primary/30 text-primary"
                      : "hover:bg-slate-50 border-2 border-transparent"
                  }`}
                >
                  <f.icon className="w-5 h-5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">{f.label}</p>
                    <p className="text-xs text-muted-foreground">{f.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-between mt-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>

          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!canProceed() || submitting}>
              {submitting ? "Creating..." : "Start Form"}
              <Zap className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
