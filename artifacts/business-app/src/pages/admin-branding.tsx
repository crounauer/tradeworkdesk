import { Redirect } from "wouter";

export default function AdminBranding() {
  return <Redirect to="/admin/company-settings?tab=profile" />;
}
