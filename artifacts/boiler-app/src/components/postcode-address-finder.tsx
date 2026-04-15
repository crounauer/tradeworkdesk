import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AddressResult {
  line_1: string;
  line_2: string;
  line_3: string;
  post_town: string;
  county: string;
  postcode: string;
  latitude: number;
  longitude: number;
  display: string;
}

interface PostcodeAddressFinderProps {
  onAddressSelected: (address: {
    address_line1: string;
    address_line2: string;
    city: string;
    county: string;
    postcode: string;
    latitude: number;
    longitude: number;
  }) => void;
  initialPostcode?: string;
}

export function PostcodeAddressFinder({ onAddressSelected, initialPostcode }: PostcodeAddressFinderProps) {
  const [postcode, setPostcode] = useState(initialPostcode || "");
  const [loading, setLoading] = useState(false);
  const [addresses, setAddresses] = useState<AddressResult[]>([]);
  const [searched, setSearched] = useState(false);
  const { toast } = useToast();

  const handleSearch = async () => {
    const pc = postcode.trim();
    if (!pc) {
      toast({ title: "Enter a postcode", description: "Type a UK postcode to find addresses", variant: "destructive" });
      return;
    }

    setLoading(true);
    setAddresses([]);
    setSearched(false);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/postcode-lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ postcode: pc }),
      });

      if (res.status === 402) {
        const data = await res.json();
        toast({ title: "Add-on required", description: data.error || "UK Address Lookup add-on is required for this feature", variant: "destructive" });
        return;
      }

      if (res.status === 404) {
        const data = await res.json();
        toast({ title: "Not found", description: data.error || "No addresses found for this postcode", variant: "destructive" });
        setSearched(true);
        return;
      }

      if (!res.ok) throw new Error("Lookup failed");

      const data = await res.json();
      setAddresses(data.addresses || []);
      setSearched(true);
    } catch {
      toast({ title: "Error", description: "Failed to look up postcode. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (addr: AddressResult) => {
    onAddressSelected({
      address_line1: addr.line_1,
      address_line2: [addr.line_2, addr.line_3].filter(Boolean).join(", "),
      city: addr.post_town,
      county: addr.county,
      postcode: addr.postcode,
      latitude: addr.latitude,
      longitude: addr.longitude,
    });
    setAddresses([]);
    setSearched(false);
    toast({ title: "Address selected", description: addr.display });
  };

  return (
    <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/50 p-4">
      <Label className="text-sm font-medium">Find Address by Postcode</Label>
      <div className="flex gap-2">
        <Input
          placeholder="e.g. AB41 8DH"
          value={postcode}
          onChange={e => setPostcode(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleSearch())}
          className="flex-1 bg-white"
        />
        <Button type="button" variant="secondary" size="sm" onClick={handleSearch} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-1" />}
          {loading ? "Searching..." : "Find"}
        </Button>
      </div>

      {addresses.length > 0 && (
        <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-white divide-y divide-border/50">
          {addresses.map((addr, i) => (
            <button
              key={i}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors"
              onClick={() => handleSelect(addr)}
            >
              {addr.display}, {addr.post_town}, {addr.postcode}
            </button>
          ))}
        </div>
      )}

      {searched && addresses.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground">No addresses found. Check the postcode and try again.</p>
      )}
    </div>
  );
}
