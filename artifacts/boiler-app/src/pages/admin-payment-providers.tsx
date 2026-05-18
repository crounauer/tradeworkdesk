import { useEffect } from "react";
import { useSearch } from "wouter";

// This page has moved to the Payments tab on Company Settings.
// Redirect preserving any OAuth callback params (gc_success, error).
export default function AdminPaymentProviders() {
  const search = useSearch();
  useEffect(() => {
    const params = new URLSearchParams(search);
    params.set("tab", "payments");
    window.location.replace(`/admin/company-settings?${params.toString()}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
