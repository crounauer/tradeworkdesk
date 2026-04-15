import { useEffect, useState } from "react";
import { useOffline } from "@/contexts/offline-context";
import { useQuery } from "@tanstack/react-query";
import {
  useListCustomers,
  useListProperties,
  useListProfiles,
  getListCustomersQueryKey,
  getListPropertiesQueryKey,
  getListProfilesQueryKey,
} from "@workspace/api-client-react";

const CACHE_KEYS = {
  customers: "ref:customers",
  properties: "ref:properties",
  jobTypes: "ref:jobTypes",
  technicians: "ref:technicians",
} as const;

const DEFER_MS = 3000;

export function useOfflineReferenceDataSync() {
  const { isOnline, setCachedData } = useOffline();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setReady(true), DEFER_MS);
    return () => clearTimeout(id);
  }, []);

  const enabled = isOnline && ready;

  const { data: customers } = useListCustomers(undefined, {
    query: {
      queryKey: getListCustomersQueryKey(),
      enabled,
    },
  });
  const { data: properties } = useListProperties(undefined, {
    query: {
      queryKey: getListPropertiesQueryKey(),
      enabled,
    },
  });
  const { data: technicians } = useListProfiles({
    query: {
      queryKey: getListProfilesQueryKey(),
      enabled,
    },
  });
  const { data: jobTypes } = useQuery<Array<Record<string, unknown>>>({
    queryKey: ["job-types-offline-cache"],
    queryFn: async () => {
      const res = await fetch("/api/job-types");
      if (!res.ok) return [];
      return res.json();
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (isOnline && customers && customers.length > 0) {
      setCachedData(CACHE_KEYS.customers, customers);
    }
  }, [isOnline, customers, setCachedData]);

  useEffect(() => {
    if (isOnline && properties && properties.length > 0) {
      setCachedData(CACHE_KEYS.properties, properties);
    }
  }, [isOnline, properties, setCachedData]);

  useEffect(() => {
    if (isOnline && technicians && technicians.length > 0) {
      setCachedData(CACHE_KEYS.technicians, technicians);
    }
  }, [isOnline, technicians, setCachedData]);

  useEffect(() => {
    if (isOnline && jobTypes && jobTypes.length > 0) {
      setCachedData(CACHE_KEYS.jobTypes, jobTypes);
    }
  }, [isOnline, jobTypes, setCachedData]);
}

export function useCacheJobTypes(jobTypes: unknown[] | undefined) {
  const { isOnline, setCachedData } = useOffline();

  useEffect(() => {
    if (isOnline && jobTypes && jobTypes.length > 0) {
      setCachedData(CACHE_KEYS.jobTypes, jobTypes);
    }
  }, [isOnline, jobTypes, setCachedData]);
}

export async function getCachedCustomers(getCachedData: <T>(key: string) => Promise<T | null>) {
  return getCachedData<Array<Record<string, unknown>>>(CACHE_KEYS.customers);
}

export async function getCachedProperties(getCachedData: <T>(key: string) => Promise<T | null>) {
  return getCachedData<Array<Record<string, unknown>>>(CACHE_KEYS.properties);
}

export async function getCachedJobTypes(getCachedData: <T>(key: string) => Promise<T | null>) {
  return getCachedData<Array<Record<string, unknown>>>(CACHE_KEYS.jobTypes);
}

export async function getCachedTechnicians(getCachedData: <T>(key: string) => Promise<T | null>) {
  return getCachedData<Array<Record<string, unknown>>>(CACHE_KEYS.technicians);
}

export { CACHE_KEYS };
