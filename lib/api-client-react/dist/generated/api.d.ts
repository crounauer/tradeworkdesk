import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from "@tanstack/react-query";
import type { Appliance, ApplianceDetail, BreakdownReport, BurnerSetupRecord, CombustionAnalysisRecord, CommissioningRecord, CreateApplianceBody, CreateBreakdownReportBody, CreateBurnerSetupRecordBody, CreateCombustionAnalysisRecordBody, CreateCommissioningRecordBody, CreateCustomerBody, CreateFireValveTestRecordBody, CreateJobBody, CreateJobCompletionReportBody, CreateJobNoteBody, CreateOilLineVacuumTestBody, CreateOilTankInspectionBody, CreateOilTankRiskAssessmentBody, CreatePropertyBody, CreateServiceRecordBody, CreateSignatureBody, Customer, CustomerDetail, DashboardData, FileAttachment, FileUrl, FireValveTestRecord, GetCompletedByTechnicianParams, GlobalSearchParams, HealthStatus, Job, JobCompletionReport, JobDetail, JobListItem, JobNote, ListAppliancesParams, ListCustomersParams, ListFilesParams, ListJobsParams, ListPropertiesParams, OilLineVacuumTest, OilTankInspection, OilTankRiskAssessment, Profile, Property, PropertyDetail, SearchResults, ServiceRecord, Signature, TechnicianStats, UpcomingService, UpdateApplianceBody, UpdateBreakdownReportBody, UpdateBurnerSetupRecordBody, UpdateCombustionAnalysisRecordBody, UpdateCommissioningRecordBody, UpdateCustomerBody, UpdateFireValveTestRecordBody, UpdateJobBody, UpdateJobCompletionReportBody, UpdateOilLineVacuumTestBody, UpdateOilTankInspectionBody, UpdateOilTankRiskAssessmentBody, UpdateProfileBody, UpdatePropertyBody, UpdateServiceRecordBody, UploadFileBody, HeatPumpServiceRecord, CreateHeatPumpServiceRecordBody, UpdateHeatPumpServiceRecordBody, HeatPumpCommissioningRecord, CreateHeatPumpCommissioningRecordBody, UpdateHeatPumpCommissioningRecordBody } from "./api.schemas";
import { customFetch } from "../custom-fetch";
import type { ErrorType, BodyType } from "../custom-fetch";
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
/**
 * @summary Health check
 */
export declare const getHealthCheckUrl: () => string;
export declare const healthCheck: (options?: RequestInit) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Get current user profile
 */
export declare const getGetProfileUrl: () => string;
export declare const getProfile: (options?: RequestInit) => Promise<Profile>;
export declare const getGetProfileQueryKey: () => readonly ["/api/auth/profile"];
export declare const getGetProfileQueryOptions: <TData = Awaited<ReturnType<typeof getProfile>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getProfile>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getProfile>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetProfileQueryResult = NonNullable<Awaited<ReturnType<typeof getProfile>>>;
export type GetProfileQueryError = ErrorType<unknown>;
/**
 * @summary Get current user profile
 */
export declare function useGetProfile<TData = Awaited<ReturnType<typeof getProfile>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getProfile>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update current user profile
 */
export declare const getUpdateProfileUrl: () => string;
export declare const updateProfile: (updateProfileBody: UpdateProfileBody, options?: RequestInit) => Promise<Profile>;
export declare const getUpdateProfileMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateProfile>>, TError, {
        data: BodyType<UpdateProfileBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateProfile>>, TError, {
    data: BodyType<UpdateProfileBody>;
}, TContext>;
export type UpdateProfileMutationResult = NonNullable<Awaited<ReturnType<typeof updateProfile>>>;
export type UpdateProfileMutationBody = BodyType<UpdateProfileBody>;
export type UpdateProfileMutationError = ErrorType<unknown>;
/**
 * @summary Update current user profile
 */
export declare const useUpdateProfile: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateProfile>>, TError, {
        data: BodyType<UpdateProfileBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateProfile>>, TError, {
    data: BodyType<UpdateProfileBody>;
}, TContext>;
/**
 * @summary List all user profiles (technicians)
 */
export declare const getListProfilesUrl: () => string;
export declare const listProfiles: (options?: RequestInit) => Promise<Profile[]>;
export declare const getListProfilesQueryKey: () => readonly ["/api/auth/profiles"];
export declare const getListProfilesQueryOptions: <TData = Awaited<ReturnType<typeof listProfiles>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listProfiles>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listProfiles>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListProfilesQueryResult = NonNullable<Awaited<ReturnType<typeof listProfiles>>>;
export type ListProfilesQueryError = ErrorType<unknown>;
/**
 * @summary List all user profiles (technicians)
 */
export declare function useListProfiles<TData = Awaited<ReturnType<typeof listProfiles>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listProfiles>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Get dashboard data
 */
export declare const getGetDashboardUrl: () => string;
export declare const getDashboard: (options?: RequestInit) => Promise<DashboardData>;
export declare const getGetDashboardQueryKey: () => readonly ["/api/dashboard"];
export declare const getGetDashboardQueryOptions: <TData = Awaited<ReturnType<typeof getDashboard>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDashboard>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getDashboard>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetDashboardQueryResult = NonNullable<Awaited<ReturnType<typeof getDashboard>>>;
export type GetDashboardQueryError = ErrorType<unknown>;
/**
 * @summary Get dashboard data
 */
export declare function useGetDashboard<TData = Awaited<ReturnType<typeof getDashboard>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDashboard>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary List customers
 */
export declare const getListCustomersUrl: (params?: ListCustomersParams) => string;
export declare const listCustomers: (params?: ListCustomersParams, options?: RequestInit) => Promise<Customer[]>;
export declare const getListCustomersQueryKey: (params?: ListCustomersParams) => readonly ["/api/customers", ...ListCustomersParams[]];
export declare const getListCustomersQueryOptions: <TData = Awaited<ReturnType<typeof listCustomers>>, TError = ErrorType<unknown>>(params?: ListCustomersParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listCustomers>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listCustomers>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListCustomersQueryResult = NonNullable<Awaited<ReturnType<typeof listCustomers>>>;
export type ListCustomersQueryError = ErrorType<unknown>;
/**
 * @summary List customers
 */
export declare function useListCustomers<TData = Awaited<ReturnType<typeof listCustomers>>, TError = ErrorType<unknown>>(params?: ListCustomersParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listCustomers>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create a customer
 */
export declare const getCreateCustomerUrl: () => string;
export declare const createCustomer: (createCustomerBody: CreateCustomerBody, options?: RequestInit) => Promise<Customer>;
export declare const getCreateCustomerMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createCustomer>>, TError, {
        data: BodyType<CreateCustomerBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createCustomer>>, TError, {
    data: BodyType<CreateCustomerBody>;
}, TContext>;
export type CreateCustomerMutationResult = NonNullable<Awaited<ReturnType<typeof createCustomer>>>;
export type CreateCustomerMutationBody = BodyType<CreateCustomerBody>;
export type CreateCustomerMutationError = ErrorType<unknown>;
/**
 * @summary Create a customer
 */
export declare const useCreateCustomer: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createCustomer>>, TError, {
        data: BodyType<CreateCustomerBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createCustomer>>, TError, {
    data: BodyType<CreateCustomerBody>;
}, TContext>;
/**
 * @summary Get customer by ID
 */
export declare const getGetCustomerUrl: (id: string) => string;
export declare const getCustomer: (id: string, options?: RequestInit) => Promise<CustomerDetail>;
export declare const getGetCustomerQueryKey: (id: string) => readonly [`/api/customers/${string}`];
export declare const getGetCustomerQueryOptions: <TData = Awaited<ReturnType<typeof getCustomer>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCustomer>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getCustomer>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetCustomerQueryResult = NonNullable<Awaited<ReturnType<typeof getCustomer>>>;
export type GetCustomerQueryError = ErrorType<unknown>;
/**
 * @summary Get customer by ID
 */
export declare function useGetCustomer<TData = Awaited<ReturnType<typeof getCustomer>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCustomer>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update customer
 */
export declare const getUpdateCustomerUrl: (id: string) => string;
export declare const updateCustomer: (id: string, updateCustomerBody: UpdateCustomerBody, options?: RequestInit) => Promise<Customer>;
export declare const getUpdateCustomerMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateCustomer>>, TError, {
        id: string;
        data: BodyType<UpdateCustomerBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateCustomer>>, TError, {
    id: string;
    data: BodyType<UpdateCustomerBody>;
}, TContext>;
export type UpdateCustomerMutationResult = NonNullable<Awaited<ReturnType<typeof updateCustomer>>>;
export type UpdateCustomerMutationBody = BodyType<UpdateCustomerBody>;
export type UpdateCustomerMutationError = ErrorType<unknown>;
/**
 * @summary Update customer
 */
export declare const useUpdateCustomer: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateCustomer>>, TError, {
        id: string;
        data: BodyType<UpdateCustomerBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateCustomer>>, TError, {
    id: string;
    data: BodyType<UpdateCustomerBody>;
}, TContext>;
/**
 * @summary Soft-delete customer
 */
export declare const getDeleteCustomerUrl: (id: string) => string;
export declare const deleteCustomer: (id: string, options?: RequestInit) => Promise<void>;
export declare const getDeleteCustomerMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteCustomer>>, TError, {
        id: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteCustomer>>, TError, {
    id: string;
}, TContext>;
export type DeleteCustomerMutationResult = NonNullable<Awaited<ReturnType<typeof deleteCustomer>>>;
export type DeleteCustomerMutationError = ErrorType<unknown>;
/**
 * @summary Soft-delete customer
 */
export declare const useDeleteCustomer: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteCustomer>>, TError, {
        id: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteCustomer>>, TError, {
    id: string;
}, TContext>;
/**
 * @summary List properties
 */
export declare const getListPropertiesUrl: (params?: ListPropertiesParams) => string;
export declare const listProperties: (params?: ListPropertiesParams, options?: RequestInit) => Promise<Property[]>;
export declare const getListPropertiesQueryKey: (params?: ListPropertiesParams) => readonly ["/api/properties", ...ListPropertiesParams[]];
export declare const getListPropertiesQueryOptions: <TData = Awaited<ReturnType<typeof listProperties>>, TError = ErrorType<unknown>>(params?: ListPropertiesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listProperties>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listProperties>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListPropertiesQueryResult = NonNullable<Awaited<ReturnType<typeof listProperties>>>;
export type ListPropertiesQueryError = ErrorType<unknown>;
/**
 * @summary List properties
 */
export declare function useListProperties<TData = Awaited<ReturnType<typeof listProperties>>, TError = ErrorType<unknown>>(params?: ListPropertiesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listProperties>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create a property
 */
export declare const getCreatePropertyUrl: () => string;
export declare const createProperty: (createPropertyBody: CreatePropertyBody, options?: RequestInit) => Promise<Property>;
export declare const getCreatePropertyMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createProperty>>, TError, {
        data: BodyType<CreatePropertyBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createProperty>>, TError, {
    data: BodyType<CreatePropertyBody>;
}, TContext>;
export type CreatePropertyMutationResult = NonNullable<Awaited<ReturnType<typeof createProperty>>>;
export type CreatePropertyMutationBody = BodyType<CreatePropertyBody>;
export type CreatePropertyMutationError = ErrorType<unknown>;
/**
 * @summary Create a property
 */
export declare const useCreateProperty: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createProperty>>, TError, {
        data: BodyType<CreatePropertyBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createProperty>>, TError, {
    data: BodyType<CreatePropertyBody>;
}, TContext>;
/**
 * @summary Get property by ID
 */
export declare const getGetPropertyUrl: (id: string) => string;
export declare const getProperty: (id: string, options?: RequestInit) => Promise<PropertyDetail>;
export declare const getGetPropertyQueryKey: (id: string) => readonly [`/api/properties/${string}`];
export declare const getGetPropertyQueryOptions: <TData = Awaited<ReturnType<typeof getProperty>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getProperty>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getProperty>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPropertyQueryResult = NonNullable<Awaited<ReturnType<typeof getProperty>>>;
export type GetPropertyQueryError = ErrorType<unknown>;
/**
 * @summary Get property by ID
 */
export declare function useGetProperty<TData = Awaited<ReturnType<typeof getProperty>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getProperty>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update property
 */
export declare const getUpdatePropertyUrl: (id: string) => string;
export declare const updateProperty: (id: string, updatePropertyBody: UpdatePropertyBody, options?: RequestInit) => Promise<Property>;
export declare const getUpdatePropertyMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateProperty>>, TError, {
        id: string;
        data: BodyType<UpdatePropertyBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateProperty>>, TError, {
    id: string;
    data: BodyType<UpdatePropertyBody>;
}, TContext>;
export type UpdatePropertyMutationResult = NonNullable<Awaited<ReturnType<typeof updateProperty>>>;
export type UpdatePropertyMutationBody = BodyType<UpdatePropertyBody>;
export type UpdatePropertyMutationError = ErrorType<unknown>;
/**
 * @summary Update property
 */
export declare const useUpdateProperty: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateProperty>>, TError, {
        id: string;
        data: BodyType<UpdatePropertyBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateProperty>>, TError, {
    id: string;
    data: BodyType<UpdatePropertyBody>;
}, TContext>;
/**
 * @summary Soft-delete property
 */
export declare const getDeletePropertyUrl: (id: string) => string;
export declare const deleteProperty: (id: string, options?: RequestInit) => Promise<void>;
export declare const getDeletePropertyMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteProperty>>, TError, {
        id: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteProperty>>, TError, {
    id: string;
}, TContext>;
export type DeletePropertyMutationResult = NonNullable<Awaited<ReturnType<typeof deleteProperty>>>;
export type DeletePropertyMutationError = ErrorType<unknown>;
/**
 * @summary Soft-delete property
 */
export declare const useDeleteProperty: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteProperty>>, TError, {
        id: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteProperty>>, TError, {
    id: string;
}, TContext>;
/**
 * @summary List appliances
 */
export declare const getListAppliancesUrl: (params?: ListAppliancesParams) => string;
export declare const listAppliances: (params?: ListAppliancesParams, options?: RequestInit) => Promise<Appliance[]>;
export declare const getListAppliancesQueryKey: (params?: ListAppliancesParams) => readonly ["/api/appliances", ...ListAppliancesParams[]];
export declare const getListAppliancesQueryOptions: <TData = Awaited<ReturnType<typeof listAppliances>>, TError = ErrorType<unknown>>(params?: ListAppliancesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAppliances>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listAppliances>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListAppliancesQueryResult = NonNullable<Awaited<ReturnType<typeof listAppliances>>>;
export type ListAppliancesQueryError = ErrorType<unknown>;
/**
 * @summary List appliances
 */
export declare function useListAppliances<TData = Awaited<ReturnType<typeof listAppliances>>, TError = ErrorType<unknown>>(params?: ListAppliancesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAppliances>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create an appliance
 */
export declare const getCreateApplianceUrl: () => string;
export declare const createAppliance: (createApplianceBody: CreateApplianceBody, options?: RequestInit) => Promise<Appliance>;
export declare const getCreateApplianceMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createAppliance>>, TError, {
        data: BodyType<CreateApplianceBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createAppliance>>, TError, {
    data: BodyType<CreateApplianceBody>;
}, TContext>;
export type CreateApplianceMutationResult = NonNullable<Awaited<ReturnType<typeof createAppliance>>>;
export type CreateApplianceMutationBody = BodyType<CreateApplianceBody>;
export type CreateApplianceMutationError = ErrorType<unknown>;
/**
 * @summary Create an appliance
 */
export declare const useCreateAppliance: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createAppliance>>, TError, {
        data: BodyType<CreateApplianceBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createAppliance>>, TError, {
    data: BodyType<CreateApplianceBody>;
}, TContext>;
/**
 * @summary Get appliance by ID
 */
export declare const getGetApplianceUrl: (id: string) => string;
export declare const getAppliance: (id: string, options?: RequestInit) => Promise<ApplianceDetail>;
export declare const getGetApplianceQueryKey: (id: string) => readonly [`/api/appliances/${string}`];
export declare const getGetApplianceQueryOptions: <TData = Awaited<ReturnType<typeof getAppliance>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAppliance>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAppliance>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetApplianceQueryResult = NonNullable<Awaited<ReturnType<typeof getAppliance>>>;
export type GetApplianceQueryError = ErrorType<unknown>;
/**
 * @summary Get appliance by ID
 */
export declare function useGetAppliance<TData = Awaited<ReturnType<typeof getAppliance>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAppliance>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update appliance
 */
export declare const getUpdateApplianceUrl: (id: string) => string;
export declare const updateAppliance: (id: string, updateApplianceBody: UpdateApplianceBody, options?: RequestInit) => Promise<Appliance>;
export declare const getUpdateApplianceMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateAppliance>>, TError, {
        id: string;
        data: BodyType<UpdateApplianceBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateAppliance>>, TError, {
    id: string;
    data: BodyType<UpdateApplianceBody>;
}, TContext>;
export type UpdateApplianceMutationResult = NonNullable<Awaited<ReturnType<typeof updateAppliance>>>;
export type UpdateApplianceMutationBody = BodyType<UpdateApplianceBody>;
export type UpdateApplianceMutationError = ErrorType<unknown>;
/**
 * @summary Update appliance
 */
export declare const useUpdateAppliance: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateAppliance>>, TError, {
        id: string;
        data: BodyType<UpdateApplianceBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateAppliance>>, TError, {
    id: string;
    data: BodyType<UpdateApplianceBody>;
}, TContext>;
/**
 * @summary Soft-delete appliance
 */
export declare const getDeleteApplianceUrl: (id: string) => string;
export declare const deleteAppliance: (id: string, options?: RequestInit) => Promise<void>;
export declare const getDeleteApplianceMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteAppliance>>, TError, {
        id: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteAppliance>>, TError, {
    id: string;
}, TContext>;
export type DeleteApplianceMutationResult = NonNullable<Awaited<ReturnType<typeof deleteAppliance>>>;
export type DeleteApplianceMutationError = ErrorType<unknown>;
/**
 * @summary Soft-delete appliance
 */
export declare const useDeleteAppliance: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteAppliance>>, TError, {
        id: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteAppliance>>, TError, {
    id: string;
}, TContext>;
/**
 * @summary List jobs
 */
export declare const getListJobsUrl: (params?: ListJobsParams) => string;
export declare const listJobs: (params?: ListJobsParams, options?: RequestInit) => Promise<JobListItem[]>;
export declare const getListJobsQueryKey: (params?: ListJobsParams) => readonly ["/api/jobs", ...ListJobsParams[]];
export declare const getListJobsQueryOptions: <TData = Awaited<ReturnType<typeof listJobs>>, TError = ErrorType<unknown>>(params?: ListJobsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listJobs>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listJobs>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListJobsQueryResult = NonNullable<Awaited<ReturnType<typeof listJobs>>>;
export type ListJobsQueryError = ErrorType<unknown>;
/**
 * @summary List jobs
 */
export declare function useListJobs<TData = Awaited<ReturnType<typeof listJobs>>, TError = ErrorType<unknown>>(params?: ListJobsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listJobs>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create a job
 */
export declare const getCreateJobUrl: () => string;
export declare const createJob: (createJobBody: CreateJobBody, options?: RequestInit) => Promise<Job>;
export declare const getCreateJobMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createJob>>, TError, {
        data: BodyType<CreateJobBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createJob>>, TError, {
    data: BodyType<CreateJobBody>;
}, TContext>;
export type CreateJobMutationResult = NonNullable<Awaited<ReturnType<typeof createJob>>>;
export type CreateJobMutationBody = BodyType<CreateJobBody>;
export type CreateJobMutationError = ErrorType<unknown>;
/**
 * @summary Create a job
 */
export declare const useCreateJob: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createJob>>, TError, {
        data: BodyType<CreateJobBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createJob>>, TError, {
    data: BodyType<CreateJobBody>;
}, TContext>;
/**
 * @summary Get job by ID
 */
export declare const getGetJobUrl: (id: string) => string;
export declare const getJob: (id: string, options?: RequestInit) => Promise<JobDetail>;
export declare const getGetJobQueryKey: (id: string) => readonly [`/api/jobs/${string}`];
export declare const getGetJobQueryOptions: <TData = Awaited<ReturnType<typeof getJob>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getJob>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getJob>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetJobQueryResult = NonNullable<Awaited<ReturnType<typeof getJob>>>;
export type GetJobQueryError = ErrorType<unknown>;
/**
 * @summary Get job by ID
 */
export declare function useGetJob<TData = Awaited<ReturnType<typeof getJob>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getJob>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update job
 */
export declare const getUpdateJobUrl: (id: string) => string;
export declare const updateJob: (id: string, updateJobBody: UpdateJobBody, options?: RequestInit) => Promise<Job>;
export declare const getUpdateJobMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateJob>>, TError, {
        id: string;
        data: BodyType<UpdateJobBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateJob>>, TError, {
    id: string;
    data: BodyType<UpdateJobBody>;
}, TContext>;
export type UpdateJobMutationResult = NonNullable<Awaited<ReturnType<typeof updateJob>>>;
export type UpdateJobMutationBody = BodyType<UpdateJobBody>;
export type UpdateJobMutationError = ErrorType<unknown>;
/**
 * @summary Update job
 */
export declare const useUpdateJob: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateJob>>, TError, {
        id: string;
        data: BodyType<UpdateJobBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateJob>>, TError, {
    id: string;
    data: BodyType<UpdateJobBody>;
}, TContext>;
/**
 * @summary Soft-delete job
 */
export declare const getDeleteJobUrl: (id: string) => string;
export declare const deleteJob: (id: string, options?: RequestInit) => Promise<void>;
export declare const getDeleteJobMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteJob>>, TError, {
        id: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteJob>>, TError, {
    id: string;
}, TContext>;
export type DeleteJobMutationResult = NonNullable<Awaited<ReturnType<typeof deleteJob>>>;
export type DeleteJobMutationError = ErrorType<unknown>;
/**
 * @summary Soft-delete job
 */
export declare const useDeleteJob: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteJob>>, TError, {
        id: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteJob>>, TError, {
    id: string;
}, TContext>;
/**
 * @summary Create a service record
 */
export declare const getCreateServiceRecordUrl: () => string;
export declare const createServiceRecord: (createServiceRecordBody: CreateServiceRecordBody, options?: RequestInit) => Promise<ServiceRecord>;
export declare const getCreateServiceRecordMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createServiceRecord>>, TError, {
        data: BodyType<CreateServiceRecordBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createServiceRecord>>, TError, {
    data: BodyType<CreateServiceRecordBody>;
}, TContext>;
export type CreateServiceRecordMutationResult = NonNullable<Awaited<ReturnType<typeof createServiceRecord>>>;
export type CreateServiceRecordMutationBody = BodyType<CreateServiceRecordBody>;
export type CreateServiceRecordMutationError = ErrorType<unknown>;
/**
 * @summary Create a service record
 */
export declare const useCreateServiceRecord: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createServiceRecord>>, TError, {
        data: BodyType<CreateServiceRecordBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createServiceRecord>>, TError, {
    data: BodyType<CreateServiceRecordBody>;
}, TContext>;
/**
 * @summary Get service record by ID
 */
export declare const getGetServiceRecordUrl: (id: string) => string;
export declare const getServiceRecord: (id: string, options?: RequestInit) => Promise<ServiceRecord>;
export declare const getGetServiceRecordQueryKey: (id: string) => readonly [`/api/service-records/${string}`];
export declare const getGetServiceRecordQueryOptions: <TData = Awaited<ReturnType<typeof getServiceRecord>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getServiceRecord>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getServiceRecord>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetServiceRecordQueryResult = NonNullable<Awaited<ReturnType<typeof getServiceRecord>>>;
export type GetServiceRecordQueryError = ErrorType<unknown>;
/**
 * @summary Get service record by ID
 */
export declare function useGetServiceRecord<TData = Awaited<ReturnType<typeof getServiceRecord>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getServiceRecord>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update service record
 */
export declare const getUpdateServiceRecordUrl: (id: string) => string;
export declare const updateServiceRecord: (id: string, updateServiceRecordBody: UpdateServiceRecordBody, options?: RequestInit) => Promise<ServiceRecord>;
export declare const getUpdateServiceRecordMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateServiceRecord>>, TError, {
        id: string;
        data: BodyType<UpdateServiceRecordBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateServiceRecord>>, TError, {
    id: string;
    data: BodyType<UpdateServiceRecordBody>;
}, TContext>;
export type UpdateServiceRecordMutationResult = NonNullable<Awaited<ReturnType<typeof updateServiceRecord>>>;
export type UpdateServiceRecordMutationBody = BodyType<UpdateServiceRecordBody>;
export type UpdateServiceRecordMutationError = ErrorType<unknown>;
/**
 * @summary Update service record
 */
export declare const useUpdateServiceRecord: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateServiceRecord>>, TError, {
        id: string;
        data: BodyType<UpdateServiceRecordBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateServiceRecord>>, TError, {
    id: string;
    data: BodyType<UpdateServiceRecordBody>;
}, TContext>;
/**
 * @summary Get service record by job ID
 */
export declare const getGetServiceRecordByJobUrl: (jobId: string) => string;
export declare const getServiceRecordByJob: (jobId: string, options?: RequestInit) => Promise<ServiceRecord>;
export declare const getGetServiceRecordByJobQueryKey: (jobId: string) => readonly [`/api/service-records/job/${string}`];
export declare const getGetServiceRecordByJobQueryOptions: <TData = Awaited<ReturnType<typeof getServiceRecordByJob>>, TError = ErrorType<unknown>>(jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getServiceRecordByJob>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getServiceRecordByJob>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetServiceRecordByJobQueryResult = NonNullable<Awaited<ReturnType<typeof getServiceRecordByJob>>>;
export type GetServiceRecordByJobQueryError = ErrorType<unknown>;
/**
 * @summary Get service record by job ID
 */
export declare function useGetServiceRecordByJob<TData = Awaited<ReturnType<typeof getServiceRecordByJob>>, TError = ErrorType<unknown>>(jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getServiceRecordByJob>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary List all commissioning records
 */
export declare const getListCommissioningRecordsUrl: () => string;
export declare const listCommissioningRecords: (options?: RequestInit) => Promise<CommissioningRecord[]>;
export declare const getListCommissioningRecordsQueryKey: () => readonly ["/api/commissioning-records"];
export declare const getListCommissioningRecordsQueryOptions: <TData = Awaited<ReturnType<typeof listCommissioningRecords>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listCommissioningRecords>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listCommissioningRecords>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListCommissioningRecordsQueryResult = NonNullable<Awaited<ReturnType<typeof listCommissioningRecords>>>;
export type ListCommissioningRecordsQueryError = ErrorType<unknown>;
/**
 * @summary List all commissioning records
 */
export declare function useListCommissioningRecords<TData = Awaited<ReturnType<typeof listCommissioningRecords>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listCommissioningRecords>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create a commissioning record
 */
export declare const getCreateCommissioningRecordUrl: () => string;
export declare const createCommissioningRecord: (createCommissioningRecordBody: CreateCommissioningRecordBody, options?: RequestInit) => Promise<CommissioningRecord>;
export declare const getCreateCommissioningRecordMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createCommissioningRecord>>, TError, {
        data: BodyType<CreateCommissioningRecordBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createCommissioningRecord>>, TError, {
    data: BodyType<CreateCommissioningRecordBody>;
}, TContext>;
export type CreateCommissioningRecordMutationResult = NonNullable<Awaited<ReturnType<typeof createCommissioningRecord>>>;
export type CreateCommissioningRecordMutationBody = BodyType<CreateCommissioningRecordBody>;
export type CreateCommissioningRecordMutationError = ErrorType<unknown>;
/**
 * @summary Create a commissioning record
 */
export declare const useCreateCommissioningRecord: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createCommissioningRecord>>, TError, {
        data: BodyType<CreateCommissioningRecordBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createCommissioningRecord>>, TError, {
    data: BodyType<CreateCommissioningRecordBody>;
}, TContext>;
/**
 * @summary Get commissioning record by ID
 */
export declare const getGetCommissioningRecordUrl: (id: string) => string;
export declare const getCommissioningRecord: (id: string, options?: RequestInit) => Promise<CommissioningRecord>;
export declare const getGetCommissioningRecordQueryKey: (id: string) => readonly [`/api/commissioning-records/${string}`];
export declare const getGetCommissioningRecordQueryOptions: <TData = Awaited<ReturnType<typeof getCommissioningRecord>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCommissioningRecord>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getCommissioningRecord>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetCommissioningRecordQueryResult = NonNullable<Awaited<ReturnType<typeof getCommissioningRecord>>>;
export type GetCommissioningRecordQueryError = ErrorType<unknown>;
/**
 * @summary Get commissioning record by ID
 */
export declare function useGetCommissioningRecord<TData = Awaited<ReturnType<typeof getCommissioningRecord>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCommissioningRecord>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update commissioning record
 */
export declare const getUpdateCommissioningRecordUrl: (id: string) => string;
export declare const updateCommissioningRecord: (id: string, updateCommissioningRecordBody: UpdateCommissioningRecordBody, options?: RequestInit) => Promise<CommissioningRecord>;
export declare const getUpdateCommissioningRecordMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateCommissioningRecord>>, TError, {
        id: string;
        data: BodyType<UpdateCommissioningRecordBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateCommissioningRecord>>, TError, {
    id: string;
    data: BodyType<UpdateCommissioningRecordBody>;
}, TContext>;
export type UpdateCommissioningRecordMutationResult = NonNullable<Awaited<ReturnType<typeof updateCommissioningRecord>>>;
export type UpdateCommissioningRecordMutationBody = BodyType<UpdateCommissioningRecordBody>;
export type UpdateCommissioningRecordMutationError = ErrorType<unknown>;
/**
 * @summary Update commissioning record
 */
export declare const useUpdateCommissioningRecord: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateCommissioningRecord>>, TError, {
        id: string;
        data: BodyType<UpdateCommissioningRecordBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateCommissioningRecord>>, TError, {
    id: string;
    data: BodyType<UpdateCommissioningRecordBody>;
}, TContext>;
/**
 * @summary Get commissioning record by job ID
 */
export declare const getGetCommissioningRecordByJobUrl: (jobId: string) => string;
export declare const getCommissioningRecordByJob: (jobId: string, options?: RequestInit) => Promise<CommissioningRecord>;
export declare const getGetCommissioningRecordByJobQueryKey: (jobId: string) => readonly [`/api/jobs/${string}/commissioning-record`];
export declare const getGetCommissioningRecordByJobQueryOptions: <TData = Awaited<ReturnType<typeof getCommissioningRecordByJob>>, TError = ErrorType<unknown>>(jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCommissioningRecordByJob>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getCommissioningRecordByJob>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetCommissioningRecordByJobQueryResult = NonNullable<Awaited<ReturnType<typeof getCommissioningRecordByJob>>>;
export type GetCommissioningRecordByJobQueryError = ErrorType<unknown>;
/**
 * @summary Get commissioning record by job ID
 */
export declare function useGetCommissioningRecordByJob<TData = Awaited<ReturnType<typeof getCommissioningRecordByJob>>, TError = ErrorType<unknown>>(jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCommissioningRecordByJob>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create a breakdown report
 */
export declare const getCreateBreakdownReportUrl: () => string;
export declare const createBreakdownReport: (createBreakdownReportBody: CreateBreakdownReportBody, options?: RequestInit) => Promise<BreakdownReport>;
export declare const getCreateBreakdownReportMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createBreakdownReport>>, TError, {
        data: BodyType<CreateBreakdownReportBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createBreakdownReport>>, TError, {
    data: BodyType<CreateBreakdownReportBody>;
}, TContext>;
export type CreateBreakdownReportMutationResult = NonNullable<Awaited<ReturnType<typeof createBreakdownReport>>>;
export type CreateBreakdownReportMutationBody = BodyType<CreateBreakdownReportBody>;
export type CreateBreakdownReportMutationError = ErrorType<unknown>;
/**
 * @summary Create a breakdown report
 */
export declare const useCreateBreakdownReport: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createBreakdownReport>>, TError, {
        data: BodyType<CreateBreakdownReportBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createBreakdownReport>>, TError, {
    data: BodyType<CreateBreakdownReportBody>;
}, TContext>;
/**
 * @summary Get breakdown report by ID
 */
export declare const getGetBreakdownReportUrl: (id: string) => string;
export declare const getBreakdownReport: (id: string, options?: RequestInit) => Promise<BreakdownReport>;
export declare const getGetBreakdownReportQueryKey: (id: string) => readonly [`/api/breakdown-reports/${string}`];
export declare const getGetBreakdownReportQueryOptions: <TData = Awaited<ReturnType<typeof getBreakdownReport>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getBreakdownReport>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getBreakdownReport>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetBreakdownReportQueryResult = NonNullable<Awaited<ReturnType<typeof getBreakdownReport>>>;
export type GetBreakdownReportQueryError = ErrorType<unknown>;
/**
 * @summary Get breakdown report by ID
 */
export declare function useGetBreakdownReport<TData = Awaited<ReturnType<typeof getBreakdownReport>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getBreakdownReport>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update breakdown report
 */
export declare const getUpdateBreakdownReportUrl: (id: string) => string;
export declare const updateBreakdownReport: (id: string, updateBreakdownReportBody: UpdateBreakdownReportBody, options?: RequestInit) => Promise<BreakdownReport>;
export declare const getUpdateBreakdownReportMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateBreakdownReport>>, TError, {
        id: string;
        data: BodyType<UpdateBreakdownReportBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateBreakdownReport>>, TError, {
    id: string;
    data: BodyType<UpdateBreakdownReportBody>;
}, TContext>;
export type UpdateBreakdownReportMutationResult = NonNullable<Awaited<ReturnType<typeof updateBreakdownReport>>>;
export type UpdateBreakdownReportMutationBody = BodyType<UpdateBreakdownReportBody>;
export type UpdateBreakdownReportMutationError = ErrorType<unknown>;
/**
 * @summary Update breakdown report
 */
export declare const useUpdateBreakdownReport: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateBreakdownReport>>, TError, {
        id: string;
        data: BodyType<UpdateBreakdownReportBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateBreakdownReport>>, TError, {
    id: string;
    data: BodyType<UpdateBreakdownReportBody>;
}, TContext>;
/**
 * @summary Get breakdown report by job ID
 */
export declare const getGetBreakdownReportByJobUrl: (jobId: string) => string;
export declare const getBreakdownReportByJob: (jobId: string, options?: RequestInit) => Promise<BreakdownReport>;
export declare const getGetBreakdownReportByJobQueryKey: (jobId: string) => readonly [`/api/breakdown-reports/job/${string}`];
export declare const getGetBreakdownReportByJobQueryOptions: <TData = Awaited<ReturnType<typeof getBreakdownReportByJob>>, TError = ErrorType<unknown>>(jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getBreakdownReportByJob>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getBreakdownReportByJob>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetBreakdownReportByJobQueryResult = NonNullable<Awaited<ReturnType<typeof getBreakdownReportByJob>>>;
export type GetBreakdownReportByJobQueryError = ErrorType<unknown>;
/**
 * @summary Get breakdown report by job ID
 */
export declare function useGetBreakdownReportByJob<TData = Awaited<ReturnType<typeof getBreakdownReportByJob>>, TError = ErrorType<unknown>>(jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getBreakdownReportByJob>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create an oil tank inspection
 */
export declare const getCreateOilTankInspectionUrl: () => string;
export declare const createOilTankInspection: (createOilTankInspectionBody: CreateOilTankInspectionBody, options?: RequestInit) => Promise<OilTankInspection>;
export declare const getCreateOilTankInspectionMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createOilTankInspection>>, TError, {
        data: BodyType<CreateOilTankInspectionBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createOilTankInspection>>, TError, {
    data: BodyType<CreateOilTankInspectionBody>;
}, TContext>;
export type CreateOilTankInspectionMutationResult = NonNullable<Awaited<ReturnType<typeof createOilTankInspection>>>;
export type CreateOilTankInspectionMutationBody = BodyType<CreateOilTankInspectionBody>;
export type CreateOilTankInspectionMutationError = ErrorType<unknown>;
/**
 * @summary Create an oil tank inspection
 */
export declare const useCreateOilTankInspection: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createOilTankInspection>>, TError, {
        data: BodyType<CreateOilTankInspectionBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createOilTankInspection>>, TError, {
    data: BodyType<CreateOilTankInspectionBody>;
}, TContext>;
/**
 * @summary Get oil tank inspection by ID
 */
export declare const getGetOilTankInspectionUrl: (id: string) => string;
export declare const getOilTankInspection: (id: string, options?: RequestInit) => Promise<OilTankInspection>;
export declare const getGetOilTankInspectionQueryKey: (id: string) => readonly [`/api/oil-tank-inspections/${string}`];
export declare const getGetOilTankInspectionQueryOptions: <TData = Awaited<ReturnType<typeof getOilTankInspection>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getOilTankInspection>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getOilTankInspection>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetOilTankInspectionQueryResult = NonNullable<Awaited<ReturnType<typeof getOilTankInspection>>>;
export type GetOilTankInspectionQueryError = ErrorType<unknown>;
/**
 * @summary Get oil tank inspection by ID
 */
export declare function useGetOilTankInspection<TData = Awaited<ReturnType<typeof getOilTankInspection>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getOilTankInspection>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update oil tank inspection
 */
export declare const getUpdateOilTankInspectionUrl: (id: string) => string;
export declare const updateOilTankInspection: (id: string, updateOilTankInspectionBody: UpdateOilTankInspectionBody, options?: RequestInit) => Promise<OilTankInspection>;
export declare const getUpdateOilTankInspectionMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateOilTankInspection>>, TError, {
        id: string;
        data: BodyType<UpdateOilTankInspectionBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateOilTankInspection>>, TError, {
    id: string;
    data: BodyType<UpdateOilTankInspectionBody>;
}, TContext>;
export type UpdateOilTankInspectionMutationResult = NonNullable<Awaited<ReturnType<typeof updateOilTankInspection>>>;
export type UpdateOilTankInspectionMutationBody = BodyType<UpdateOilTankInspectionBody>;
export type UpdateOilTankInspectionMutationError = ErrorType<unknown>;
/**
 * @summary Update oil tank inspection
 */
export declare const useUpdateOilTankInspection: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateOilTankInspection>>, TError, {
        id: string;
        data: BodyType<UpdateOilTankInspectionBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateOilTankInspection>>, TError, {
    id: string;
    data: BodyType<UpdateOilTankInspectionBody>;
}, TContext>;
/**
 * @summary Get oil tank inspection by job ID
 */
export declare const getGetOilTankInspectionByJobUrl: (jobId: string) => string;
export declare const getOilTankInspectionByJob: (jobId: string, options?: RequestInit) => Promise<OilTankInspection>;
export declare const getGetOilTankInspectionByJobQueryKey: (jobId: string) => readonly [`/api/oil-tank-inspections/job/${string}`];
export declare const getGetOilTankInspectionByJobQueryOptions: <TData = Awaited<ReturnType<typeof getOilTankInspectionByJob>>, TError = ErrorType<unknown>>(jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getOilTankInspectionByJob>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getOilTankInspectionByJob>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetOilTankInspectionByJobQueryResult = NonNullable<Awaited<ReturnType<typeof getOilTankInspectionByJob>>>;
export type GetOilTankInspectionByJobQueryError = ErrorType<unknown>;
/**
 * @summary Get oil tank inspection by job ID
 */
export declare function useGetOilTankInspectionByJob<TData = Awaited<ReturnType<typeof getOilTankInspectionByJob>>, TError = ErrorType<unknown>>(jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getOilTankInspectionByJob>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create an oil tank risk assessment
 */
export declare const getCreateOilTankRiskAssessmentUrl: () => string;
export declare const createOilTankRiskAssessment: (createOilTankRiskAssessmentBody: CreateOilTankRiskAssessmentBody, options?: RequestInit) => Promise<OilTankRiskAssessment>;
export declare const getCreateOilTankRiskAssessmentMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createOilTankRiskAssessment>>, TError, {
        data: BodyType<CreateOilTankRiskAssessmentBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createOilTankRiskAssessment>>, TError, {
    data: BodyType<CreateOilTankRiskAssessmentBody>;
}, TContext>;
export type CreateOilTankRiskAssessmentMutationResult = NonNullable<Awaited<ReturnType<typeof createOilTankRiskAssessment>>>;
export type CreateOilTankRiskAssessmentMutationBody = BodyType<CreateOilTankRiskAssessmentBody>;
export type CreateOilTankRiskAssessmentMutationError = ErrorType<unknown>;
/**
 * @summary Create an oil tank risk assessment
 */
export declare const useCreateOilTankRiskAssessment: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createOilTankRiskAssessment>>, TError, {
        data: BodyType<CreateOilTankRiskAssessmentBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createOilTankRiskAssessment>>, TError, {
    data: BodyType<CreateOilTankRiskAssessmentBody>;
}, TContext>;
/**
 * @summary Get oil tank risk assessment by ID
 */
export declare const getGetOilTankRiskAssessmentUrl: (id: string) => string;
export declare const getOilTankRiskAssessment: (id: string, options?: RequestInit) => Promise<OilTankRiskAssessment>;
export declare const getGetOilTankRiskAssessmentQueryKey: (id: string) => readonly [`/api/oil-tank-risk-assessments/${string}`];
export declare const getGetOilTankRiskAssessmentQueryOptions: <TData = Awaited<ReturnType<typeof getOilTankRiskAssessment>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getOilTankRiskAssessment>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getOilTankRiskAssessment>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetOilTankRiskAssessmentQueryResult = NonNullable<Awaited<ReturnType<typeof getOilTankRiskAssessment>>>;
export type GetOilTankRiskAssessmentQueryError = ErrorType<unknown>;
/**
 * @summary Get oil tank risk assessment by ID
 */
export declare function useGetOilTankRiskAssessment<TData = Awaited<ReturnType<typeof getOilTankRiskAssessment>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getOilTankRiskAssessment>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update oil tank risk assessment
 */
export declare const getUpdateOilTankRiskAssessmentUrl: (id: string) => string;
export declare const updateOilTankRiskAssessment: (id: string, updateOilTankRiskAssessmentBody: UpdateOilTankRiskAssessmentBody, options?: RequestInit) => Promise<OilTankRiskAssessment>;
export declare const getUpdateOilTankRiskAssessmentMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateOilTankRiskAssessment>>, TError, {
        id: string;
        data: BodyType<UpdateOilTankRiskAssessmentBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateOilTankRiskAssessment>>, TError, {
    id: string;
    data: BodyType<UpdateOilTankRiskAssessmentBody>;
}, TContext>;
export type UpdateOilTankRiskAssessmentMutationResult = NonNullable<Awaited<ReturnType<typeof updateOilTankRiskAssessment>>>;
export type UpdateOilTankRiskAssessmentMutationBody = BodyType<UpdateOilTankRiskAssessmentBody>;
export type UpdateOilTankRiskAssessmentMutationError = ErrorType<unknown>;
/**
 * @summary Update oil tank risk assessment
 */
export declare const useUpdateOilTankRiskAssessment: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateOilTankRiskAssessment>>, TError, {
        id: string;
        data: BodyType<UpdateOilTankRiskAssessmentBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateOilTankRiskAssessment>>, TError, {
    id: string;
    data: BodyType<UpdateOilTankRiskAssessmentBody>;
}, TContext>;
/**
 * @summary Get oil tank risk assessment by job ID
 */
export declare const getGetOilTankRiskAssessmentByJobUrl: (jobId: string) => string;
export declare const getOilTankRiskAssessmentByJob: (jobId: string, options?: RequestInit) => Promise<OilTankRiskAssessment>;
export declare const getGetOilTankRiskAssessmentByJobQueryKey: (jobId: string) => readonly [`/api/oil-tank-risk-assessments/job/${string}`];
export declare const getGetOilTankRiskAssessmentByJobQueryOptions: <TData = Awaited<ReturnType<typeof getOilTankRiskAssessmentByJob>>, TError = ErrorType<unknown>>(jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getOilTankRiskAssessmentByJob>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getOilTankRiskAssessmentByJob>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetOilTankRiskAssessmentByJobQueryResult = NonNullable<Awaited<ReturnType<typeof getOilTankRiskAssessmentByJob>>>;
export type GetOilTankRiskAssessmentByJobQueryError = ErrorType<unknown>;
/**
 * @summary Get oil tank risk assessment by job ID
 */
export declare function useGetOilTankRiskAssessmentByJob<TData = Awaited<ReturnType<typeof getOilTankRiskAssessmentByJob>>, TError = ErrorType<unknown>>(jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getOilTankRiskAssessmentByJob>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create a combustion analysis record
 */
export declare const getCreateCombustionAnalysisRecordUrl: () => string;
export declare const createCombustionAnalysisRecord: (createCombustionAnalysisRecordBody: CreateCombustionAnalysisRecordBody, options?: RequestInit) => Promise<CombustionAnalysisRecord>;
export declare const getCreateCombustionAnalysisRecordMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createCombustionAnalysisRecord>>, TError, {
        data: BodyType<CreateCombustionAnalysisRecordBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createCombustionAnalysisRecord>>, TError, {
    data: BodyType<CreateCombustionAnalysisRecordBody>;
}, TContext>;
export type CreateCombustionAnalysisRecordMutationResult = NonNullable<Awaited<ReturnType<typeof createCombustionAnalysisRecord>>>;
export type CreateCombustionAnalysisRecordMutationBody = BodyType<CreateCombustionAnalysisRecordBody>;
export type CreateCombustionAnalysisRecordMutationError = ErrorType<unknown>;
/**
 * @summary Create a combustion analysis record
 */
export declare const useCreateCombustionAnalysisRecord: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createCombustionAnalysisRecord>>, TError, {
        data: BodyType<CreateCombustionAnalysisRecordBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createCombustionAnalysisRecord>>, TError, {
    data: BodyType<CreateCombustionAnalysisRecordBody>;
}, TContext>;
/**
 * @summary Get combustion analysis record by ID
 */
export declare const getGetCombustionAnalysisRecordUrl: (id: string) => string;
export declare const getCombustionAnalysisRecord: (id: string, options?: RequestInit) => Promise<CombustionAnalysisRecord>;
export declare const getGetCombustionAnalysisRecordQueryKey: (id: string) => readonly [`/api/combustion-analysis-records/${string}`];
export declare const getGetCombustionAnalysisRecordQueryOptions: <TData = Awaited<ReturnType<typeof getCombustionAnalysisRecord>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCombustionAnalysisRecord>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getCombustionAnalysisRecord>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetCombustionAnalysisRecordQueryResult = NonNullable<Awaited<ReturnType<typeof getCombustionAnalysisRecord>>>;
export type GetCombustionAnalysisRecordQueryError = ErrorType<unknown>;
/**
 * @summary Get combustion analysis record by ID
 */
export declare function useGetCombustionAnalysisRecord<TData = Awaited<ReturnType<typeof getCombustionAnalysisRecord>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCombustionAnalysisRecord>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update combustion analysis record
 */
export declare const getUpdateCombustionAnalysisRecordUrl: (id: string) => string;
export declare const updateCombustionAnalysisRecord: (id: string, updateCombustionAnalysisRecordBody: UpdateCombustionAnalysisRecordBody, options?: RequestInit) => Promise<CombustionAnalysisRecord>;
export declare const getUpdateCombustionAnalysisRecordMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateCombustionAnalysisRecord>>, TError, {
        id: string;
        data: BodyType<UpdateCombustionAnalysisRecordBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateCombustionAnalysisRecord>>, TError, {
    id: string;
    data: BodyType<UpdateCombustionAnalysisRecordBody>;
}, TContext>;
export type UpdateCombustionAnalysisRecordMutationResult = NonNullable<Awaited<ReturnType<typeof updateCombustionAnalysisRecord>>>;
export type UpdateCombustionAnalysisRecordMutationBody = BodyType<UpdateCombustionAnalysisRecordBody>;
export type UpdateCombustionAnalysisRecordMutationError = ErrorType<unknown>;
/**
 * @summary Update combustion analysis record
 */
export declare const useUpdateCombustionAnalysisRecord: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateCombustionAnalysisRecord>>, TError, {
        id: string;
        data: BodyType<UpdateCombustionAnalysisRecordBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateCombustionAnalysisRecord>>, TError, {
    id: string;
    data: BodyType<UpdateCombustionAnalysisRecordBody>;
}, TContext>;
/**
 * @summary Get combustion analysis record by job ID
 */
export declare const getGetCombustionAnalysisRecordByJobUrl: (jobId: string) => string;
export declare const getCombustionAnalysisRecordByJob: (jobId: string, options?: RequestInit) => Promise<CombustionAnalysisRecord>;
export declare const getGetCombustionAnalysisRecordByJobQueryKey: (jobId: string) => readonly [`/api/combustion-analysis-records/job/${string}`];
export declare const getGetCombustionAnalysisRecordByJobQueryOptions: <TData = Awaited<ReturnType<typeof getCombustionAnalysisRecordByJob>>, TError = ErrorType<unknown>>(jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCombustionAnalysisRecordByJob>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getCombustionAnalysisRecordByJob>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetCombustionAnalysisRecordByJobQueryResult = NonNullable<Awaited<ReturnType<typeof getCombustionAnalysisRecordByJob>>>;
export type GetCombustionAnalysisRecordByJobQueryError = ErrorType<unknown>;
/**
 * @summary Get combustion analysis record by job ID
 */
export declare function useGetCombustionAnalysisRecordByJob<TData = Awaited<ReturnType<typeof getCombustionAnalysisRecordByJob>>, TError = ErrorType<unknown>>(jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCombustionAnalysisRecordByJob>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create a burner setup record
 */
export declare const getCreateBurnerSetupRecordUrl: () => string;
export declare const createBurnerSetupRecord: (createBurnerSetupRecordBody: CreateBurnerSetupRecordBody, options?: RequestInit) => Promise<BurnerSetupRecord>;
export declare const getCreateBurnerSetupRecordMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createBurnerSetupRecord>>, TError, {
        data: BodyType<CreateBurnerSetupRecordBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createBurnerSetupRecord>>, TError, {
    data: BodyType<CreateBurnerSetupRecordBody>;
}, TContext>;
export type CreateBurnerSetupRecordMutationResult = NonNullable<Awaited<ReturnType<typeof createBurnerSetupRecord>>>;
export type CreateBurnerSetupRecordMutationBody = BodyType<CreateBurnerSetupRecordBody>;
export type CreateBurnerSetupRecordMutationError = ErrorType<unknown>;
/**
 * @summary Create a burner setup record
 */
export declare const useCreateBurnerSetupRecord: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createBurnerSetupRecord>>, TError, {
        data: BodyType<CreateBurnerSetupRecordBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createBurnerSetupRecord>>, TError, {
    data: BodyType<CreateBurnerSetupRecordBody>;
}, TContext>;
/**
 * @summary Get burner setup record by ID
 */
export declare const getGetBurnerSetupRecordUrl: (id: string) => string;
export declare const getBurnerSetupRecord: (id: string, options?: RequestInit) => Promise<BurnerSetupRecord>;
export declare const getGetBurnerSetupRecordQueryKey: (id: string) => readonly [`/api/burner-setup-records/${string}`];
export declare const getGetBurnerSetupRecordQueryOptions: <TData = Awaited<ReturnType<typeof getBurnerSetupRecord>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getBurnerSetupRecord>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getBurnerSetupRecord>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetBurnerSetupRecordQueryResult = NonNullable<Awaited<ReturnType<typeof getBurnerSetupRecord>>>;
export type GetBurnerSetupRecordQueryError = ErrorType<unknown>;
/**
 * @summary Get burner setup record by ID
 */
export declare function useGetBurnerSetupRecord<TData = Awaited<ReturnType<typeof getBurnerSetupRecord>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getBurnerSetupRecord>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update burner setup record
 */
export declare const getUpdateBurnerSetupRecordUrl: (id: string) => string;
export declare const updateBurnerSetupRecord: (id: string, updateBurnerSetupRecordBody: UpdateBurnerSetupRecordBody, options?: RequestInit) => Promise<BurnerSetupRecord>;
export declare const getUpdateBurnerSetupRecordMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateBurnerSetupRecord>>, TError, {
        id: string;
        data: BodyType<UpdateBurnerSetupRecordBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateBurnerSetupRecord>>, TError, {
    id: string;
    data: BodyType<UpdateBurnerSetupRecordBody>;
}, TContext>;
export type UpdateBurnerSetupRecordMutationResult = NonNullable<Awaited<ReturnType<typeof updateBurnerSetupRecord>>>;
export type UpdateBurnerSetupRecordMutationBody = BodyType<UpdateBurnerSetupRecordBody>;
export type UpdateBurnerSetupRecordMutationError = ErrorType<unknown>;
/**
 * @summary Update burner setup record
 */
export declare const useUpdateBurnerSetupRecord: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateBurnerSetupRecord>>, TError, {
        id: string;
        data: BodyType<UpdateBurnerSetupRecordBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateBurnerSetupRecord>>, TError, {
    id: string;
    data: BodyType<UpdateBurnerSetupRecordBody>;
}, TContext>;
/**
 * @summary Get burner setup record by job ID
 */
export declare const getGetBurnerSetupRecordByJobUrl: (jobId: string) => string;
export declare const getBurnerSetupRecordByJob: (jobId: string, options?: RequestInit) => Promise<BurnerSetupRecord>;
export declare const getGetBurnerSetupRecordByJobQueryKey: (jobId: string) => readonly [`/api/burner-setup-records/job/${string}`];
export declare const getGetBurnerSetupRecordByJobQueryOptions: <TData = Awaited<ReturnType<typeof getBurnerSetupRecordByJob>>, TError = ErrorType<unknown>>(jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getBurnerSetupRecordByJob>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getBurnerSetupRecordByJob>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetBurnerSetupRecordByJobQueryResult = NonNullable<Awaited<ReturnType<typeof getBurnerSetupRecordByJob>>>;
export type GetBurnerSetupRecordByJobQueryError = ErrorType<unknown>;
/**
 * @summary Get burner setup record by job ID
 */
export declare function useGetBurnerSetupRecordByJob<TData = Awaited<ReturnType<typeof getBurnerSetupRecordByJob>>, TError = ErrorType<unknown>>(jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getBurnerSetupRecordByJob>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create a fire valve test record
 */
export declare const getCreateFireValveTestRecordUrl: () => string;
export declare const createFireValveTestRecord: (createFireValveTestRecordBody: CreateFireValveTestRecordBody, options?: RequestInit) => Promise<FireValveTestRecord>;
export declare const getCreateFireValveTestRecordMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createFireValveTestRecord>>, TError, {
        data: BodyType<CreateFireValveTestRecordBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createFireValveTestRecord>>, TError, {
    data: BodyType<CreateFireValveTestRecordBody>;
}, TContext>;
export type CreateFireValveTestRecordMutationResult = NonNullable<Awaited<ReturnType<typeof createFireValveTestRecord>>>;
export type CreateFireValveTestRecordMutationBody = BodyType<CreateFireValveTestRecordBody>;
export type CreateFireValveTestRecordMutationError = ErrorType<unknown>;
/**
 * @summary Create a fire valve test record
 */
export declare const useCreateFireValveTestRecord: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createFireValveTestRecord>>, TError, {
        data: BodyType<CreateFireValveTestRecordBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createFireValveTestRecord>>, TError, {
    data: BodyType<CreateFireValveTestRecordBody>;
}, TContext>;
/**
 * @summary Get fire valve test record by ID
 */
export declare const getGetFireValveTestRecordUrl: (id: string) => string;
export declare const getFireValveTestRecord: (id: string, options?: RequestInit) => Promise<FireValveTestRecord>;
export declare const getGetFireValveTestRecordQueryKey: (id: string) => readonly [`/api/fire-valve-test-records/${string}`];
export declare const getGetFireValveTestRecordQueryOptions: <TData = Awaited<ReturnType<typeof getFireValveTestRecord>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getFireValveTestRecord>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getFireValveTestRecord>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetFireValveTestRecordQueryResult = NonNullable<Awaited<ReturnType<typeof getFireValveTestRecord>>>;
export type GetFireValveTestRecordQueryError = ErrorType<unknown>;
/**
 * @summary Get fire valve test record by ID
 */
export declare function useGetFireValveTestRecord<TData = Awaited<ReturnType<typeof getFireValveTestRecord>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getFireValveTestRecord>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update fire valve test record
 */
export declare const getUpdateFireValveTestRecordUrl: (id: string) => string;
export declare const updateFireValveTestRecord: (id: string, updateFireValveTestRecordBody: UpdateFireValveTestRecordBody, options?: RequestInit) => Promise<FireValveTestRecord>;
export declare const getUpdateFireValveTestRecordMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateFireValveTestRecord>>, TError, {
        id: string;
        data: BodyType<UpdateFireValveTestRecordBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateFireValveTestRecord>>, TError, {
    id: string;
    data: BodyType<UpdateFireValveTestRecordBody>;
}, TContext>;
export type UpdateFireValveTestRecordMutationResult = NonNullable<Awaited<ReturnType<typeof updateFireValveTestRecord>>>;
export type UpdateFireValveTestRecordMutationBody = BodyType<UpdateFireValveTestRecordBody>;
export type UpdateFireValveTestRecordMutationError = ErrorType<unknown>;
/**
 * @summary Update fire valve test record
 */
export declare const useUpdateFireValveTestRecord: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateFireValveTestRecord>>, TError, {
        id: string;
        data: BodyType<UpdateFireValveTestRecordBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateFireValveTestRecord>>, TError, {
    id: string;
    data: BodyType<UpdateFireValveTestRecordBody>;
}, TContext>;
/**
 * @summary Get fire valve test record by job ID
 */
export declare const getGetFireValveTestRecordByJobUrl: (jobId: string) => string;
export declare const getFireValveTestRecordByJob: (jobId: string, options?: RequestInit) => Promise<FireValveTestRecord>;
export declare const getGetFireValveTestRecordByJobQueryKey: (jobId: string) => readonly [`/api/fire-valve-test-records/job/${string}`];
export declare const getGetFireValveTestRecordByJobQueryOptions: <TData = Awaited<ReturnType<typeof getFireValveTestRecordByJob>>, TError = ErrorType<unknown>>(jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getFireValveTestRecordByJob>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getFireValveTestRecordByJob>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetFireValveTestRecordByJobQueryResult = NonNullable<Awaited<ReturnType<typeof getFireValveTestRecordByJob>>>;
export type GetFireValveTestRecordByJobQueryError = ErrorType<unknown>;
/**
 * @summary Get fire valve test record by job ID
 */
export declare function useGetFireValveTestRecordByJob<TData = Awaited<ReturnType<typeof getFireValveTestRecordByJob>>, TError = ErrorType<unknown>>(jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getFireValveTestRecordByJob>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create an oil line vacuum test
 */
export declare const getCreateOilLineVacuumTestUrl: () => string;
export declare const createOilLineVacuumTest: (createOilLineVacuumTestBody: CreateOilLineVacuumTestBody, options?: RequestInit) => Promise<OilLineVacuumTest>;
export declare const getCreateOilLineVacuumTestMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createOilLineVacuumTest>>, TError, {
        data: BodyType<CreateOilLineVacuumTestBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createOilLineVacuumTest>>, TError, {
    data: BodyType<CreateOilLineVacuumTestBody>;
}, TContext>;
export type CreateOilLineVacuumTestMutationResult = NonNullable<Awaited<ReturnType<typeof createOilLineVacuumTest>>>;
export type CreateOilLineVacuumTestMutationBody = BodyType<CreateOilLineVacuumTestBody>;
export type CreateOilLineVacuumTestMutationError = ErrorType<unknown>;
/**
 * @summary Create an oil line vacuum test
 */
export declare const useCreateOilLineVacuumTest: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createOilLineVacuumTest>>, TError, {
        data: BodyType<CreateOilLineVacuumTestBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createOilLineVacuumTest>>, TError, {
    data: BodyType<CreateOilLineVacuumTestBody>;
}, TContext>;
/**
 * @summary Get oil line vacuum test by ID
 */
export declare const getGetOilLineVacuumTestUrl: (id: string) => string;
export declare const getOilLineVacuumTest: (id: string, options?: RequestInit) => Promise<OilLineVacuumTest>;
export declare const getGetOilLineVacuumTestQueryKey: (id: string) => readonly [`/api/oil-line-vacuum-tests/${string}`];
export declare const getGetOilLineVacuumTestQueryOptions: <TData = Awaited<ReturnType<typeof getOilLineVacuumTest>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getOilLineVacuumTest>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getOilLineVacuumTest>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetOilLineVacuumTestQueryResult = NonNullable<Awaited<ReturnType<typeof getOilLineVacuumTest>>>;
export type GetOilLineVacuumTestQueryError = ErrorType<unknown>;
/**
 * @summary Get oil line vacuum test by ID
 */
export declare function useGetOilLineVacuumTest<TData = Awaited<ReturnType<typeof getOilLineVacuumTest>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getOilLineVacuumTest>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update oil line vacuum test
 */
export declare const getUpdateOilLineVacuumTestUrl: (id: string) => string;
export declare const updateOilLineVacuumTest: (id: string, updateOilLineVacuumTestBody: UpdateOilLineVacuumTestBody, options?: RequestInit) => Promise<OilLineVacuumTest>;
export declare const getUpdateOilLineVacuumTestMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateOilLineVacuumTest>>, TError, {
        id: string;
        data: BodyType<UpdateOilLineVacuumTestBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateOilLineVacuumTest>>, TError, {
    id: string;
    data: BodyType<UpdateOilLineVacuumTestBody>;
}, TContext>;
export type UpdateOilLineVacuumTestMutationResult = NonNullable<Awaited<ReturnType<typeof updateOilLineVacuumTest>>>;
export type UpdateOilLineVacuumTestMutationBody = BodyType<UpdateOilLineVacuumTestBody>;
export type UpdateOilLineVacuumTestMutationError = ErrorType<unknown>;
/**
 * @summary Update oil line vacuum test
 */
export declare const useUpdateOilLineVacuumTest: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateOilLineVacuumTest>>, TError, {
        id: string;
        data: BodyType<UpdateOilLineVacuumTestBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateOilLineVacuumTest>>, TError, {
    id: string;
    data: BodyType<UpdateOilLineVacuumTestBody>;
}, TContext>;
/**
 * @summary Get oil line vacuum test by job ID
 */
export declare const getGetOilLineVacuumTestByJobUrl: (jobId: string) => string;
export declare const getOilLineVacuumTestByJob: (jobId: string, options?: RequestInit) => Promise<OilLineVacuumTest>;
export declare const getGetOilLineVacuumTestByJobQueryKey: (jobId: string) => readonly [`/api/oil-line-vacuum-tests/job/${string}`];
export declare const getGetOilLineVacuumTestByJobQueryOptions: <TData = Awaited<ReturnType<typeof getOilLineVacuumTestByJob>>, TError = ErrorType<unknown>>(jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getOilLineVacuumTestByJob>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getOilLineVacuumTestByJob>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetOilLineVacuumTestByJobQueryResult = NonNullable<Awaited<ReturnType<typeof getOilLineVacuumTestByJob>>>;
export type GetOilLineVacuumTestByJobQueryError = ErrorType<unknown>;
/**
 * @summary Get oil line vacuum test by job ID
 */
export declare function useGetOilLineVacuumTestByJob<TData = Awaited<ReturnType<typeof getOilLineVacuumTestByJob>>, TError = ErrorType<unknown>>(jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getOilLineVacuumTestByJob>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create a job completion report
 */
export declare const getCreateJobCompletionReportUrl: () => string;
export declare const createJobCompletionReport: (createJobCompletionReportBody: CreateJobCompletionReportBody, options?: RequestInit) => Promise<JobCompletionReport>;
export declare const getCreateJobCompletionReportMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createJobCompletionReport>>, TError, {
        data: BodyType<CreateJobCompletionReportBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createJobCompletionReport>>, TError, {
    data: BodyType<CreateJobCompletionReportBody>;
}, TContext>;
export type CreateJobCompletionReportMutationResult = NonNullable<Awaited<ReturnType<typeof createJobCompletionReport>>>;
export type CreateJobCompletionReportMutationBody = BodyType<CreateJobCompletionReportBody>;
export type CreateJobCompletionReportMutationError = ErrorType<unknown>;
/**
 * @summary Create a job completion report
 */
export declare const useCreateJobCompletionReport: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createJobCompletionReport>>, TError, {
        data: BodyType<CreateJobCompletionReportBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createJobCompletionReport>>, TError, {
    data: BodyType<CreateJobCompletionReportBody>;
}, TContext>;
/**
 * @summary Get job completion report by ID
 */
export declare const getGetJobCompletionReportUrl: (id: string) => string;
export declare const getJobCompletionReport: (id: string, options?: RequestInit) => Promise<JobCompletionReport>;
export declare const getGetJobCompletionReportQueryKey: (id: string) => readonly [`/api/job-completion-reports/${string}`];
export declare const getGetJobCompletionReportQueryOptions: <TData = Awaited<ReturnType<typeof getJobCompletionReport>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getJobCompletionReport>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getJobCompletionReport>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetJobCompletionReportQueryResult = NonNullable<Awaited<ReturnType<typeof getJobCompletionReport>>>;
export type GetJobCompletionReportQueryError = ErrorType<unknown>;
/**
 * @summary Get job completion report by ID
 */
export declare function useGetJobCompletionReport<TData = Awaited<ReturnType<typeof getJobCompletionReport>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getJobCompletionReport>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update job completion report
 */
export declare const getUpdateJobCompletionReportUrl: (id: string) => string;
export declare const updateJobCompletionReport: (id: string, updateJobCompletionReportBody: UpdateJobCompletionReportBody, options?: RequestInit) => Promise<JobCompletionReport>;
export declare const getUpdateJobCompletionReportMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateJobCompletionReport>>, TError, {
        id: string;
        data: BodyType<UpdateJobCompletionReportBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateJobCompletionReport>>, TError, {
    id: string;
    data: BodyType<UpdateJobCompletionReportBody>;
}, TContext>;
export type UpdateJobCompletionReportMutationResult = NonNullable<Awaited<ReturnType<typeof updateJobCompletionReport>>>;
export type UpdateJobCompletionReportMutationBody = BodyType<UpdateJobCompletionReportBody>;
export type UpdateJobCompletionReportMutationError = ErrorType<unknown>;
/**
 * @summary Update job completion report
 */
export declare const useUpdateJobCompletionReport: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateJobCompletionReport>>, TError, {
        id: string;
        data: BodyType<UpdateJobCompletionReportBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateJobCompletionReport>>, TError, {
    id: string;
    data: BodyType<UpdateJobCompletionReportBody>;
}, TContext>;
/**
 * @summary Get job completion report by job ID
 */
export declare const getGetJobCompletionReportByJobUrl: (jobId: string) => string;
export declare const getJobCompletionReportByJob: (jobId: string, options?: RequestInit) => Promise<JobCompletionReport>;
export declare const getGetJobCompletionReportByJobQueryKey: (jobId: string) => readonly [`/api/job-completion-reports/job/${string}`];
export declare const getGetJobCompletionReportByJobQueryOptions: <TData = Awaited<ReturnType<typeof getJobCompletionReportByJob>>, TError = ErrorType<unknown>>(jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getJobCompletionReportByJob>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getJobCompletionReportByJob>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetJobCompletionReportByJobQueryResult = NonNullable<Awaited<ReturnType<typeof getJobCompletionReportByJob>>>;
export type GetJobCompletionReportByJobQueryError = ErrorType<unknown>;
/**
 * @summary Get job completion report by job ID
 */
export declare function useGetJobCompletionReportByJob<TData = Awaited<ReturnType<typeof getJobCompletionReportByJob>>, TError = ErrorType<unknown>>(jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getJobCompletionReportByJob>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary List notes for a job
 */
export declare const getListJobNotesUrl: (jobId: string) => string;
export declare const listJobNotes: (jobId: string, options?: RequestInit) => Promise<JobNote[]>;
export declare const getListJobNotesQueryKey: (jobId: string) => readonly [`/api/jobs/${string}/notes`];
export declare const getListJobNotesQueryOptions: <TData = Awaited<ReturnType<typeof listJobNotes>>, TError = ErrorType<unknown>>(jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listJobNotes>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listJobNotes>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListJobNotesQueryResult = NonNullable<Awaited<ReturnType<typeof listJobNotes>>>;
export type ListJobNotesQueryError = ErrorType<unknown>;
/**
 * @summary List notes for a job
 */
export declare function useListJobNotes<TData = Awaited<ReturnType<typeof listJobNotes>>, TError = ErrorType<unknown>>(jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listJobNotes>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create a job note
 */
export declare const getCreateJobNoteUrl: (jobId: string) => string;
export declare const createJobNote: (jobId: string, createJobNoteBody: CreateJobNoteBody, options?: RequestInit) => Promise<JobNote>;
export declare const getCreateJobNoteMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createJobNote>>, TError, {
        jobId: string;
        data: BodyType<CreateJobNoteBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createJobNote>>, TError, {
    jobId: string;
    data: BodyType<CreateJobNoteBody>;
}, TContext>;
export type CreateJobNoteMutationResult = NonNullable<Awaited<ReturnType<typeof createJobNote>>>;
export type CreateJobNoteMutationBody = BodyType<CreateJobNoteBody>;
export type CreateJobNoteMutationError = ErrorType<unknown>;
/**
 * @summary Create a job note
 */
export declare const useCreateJobNote: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createJobNote>>, TError, {
        jobId: string;
        data: BodyType<CreateJobNoteBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createJobNote>>, TError, {
    jobId: string;
    data: BodyType<CreateJobNoteBody>;
}, TContext>;
/**
 * @summary List file attachments
 */
export declare const getListFilesUrl: (params: ListFilesParams) => string;
export declare const listFiles: (params: ListFilesParams, options?: RequestInit) => Promise<FileAttachment[]>;
export declare const getListFilesQueryKey: (params?: ListFilesParams) => readonly ["/api/files", ...ListFilesParams[]];
export declare const getListFilesQueryOptions: <TData = Awaited<ReturnType<typeof listFiles>>, TError = ErrorType<unknown>>(params: ListFilesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listFiles>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listFiles>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListFilesQueryResult = NonNullable<Awaited<ReturnType<typeof listFiles>>>;
export type ListFilesQueryError = ErrorType<unknown>;
/**
 * @summary List file attachments
 */
export declare function useListFiles<TData = Awaited<ReturnType<typeof listFiles>>, TError = ErrorType<unknown>>(params: ListFilesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listFiles>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Upload a file
 */
export declare const getUploadFileUrl: () => string;
export declare const uploadFile: (uploadFileBody: UploadFileBody, options?: RequestInit) => Promise<FileAttachment>;
export declare const getUploadFileMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof uploadFile>>, TError, {
        data: BodyType<UploadFileBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof uploadFile>>, TError, {
    data: BodyType<UploadFileBody>;
}, TContext>;
export type UploadFileMutationResult = NonNullable<Awaited<ReturnType<typeof uploadFile>>>;
export type UploadFileMutationBody = BodyType<UploadFileBody>;
export type UploadFileMutationError = ErrorType<unknown>;
/**
 * @summary Upload a file
 */
export declare const useUploadFile: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof uploadFile>>, TError, {
        data: BodyType<UploadFileBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof uploadFile>>, TError, {
    data: BodyType<UploadFileBody>;
}, TContext>;
/**
 * @summary Delete a file attachment
 */
export declare const getDeleteFileUrl: (id: string) => string;
export declare const deleteFile: (id: string, options?: RequestInit) => Promise<void>;
export declare const getDeleteFileMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteFile>>, TError, {
        id: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteFile>>, TError, {
    id: string;
}, TContext>;
export type DeleteFileMutationResult = NonNullable<Awaited<ReturnType<typeof deleteFile>>>;
export type DeleteFileMutationError = ErrorType<unknown>;
/**
 * @summary Delete a file attachment
 */
export declare const useDeleteFile: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteFile>>, TError, {
        id: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteFile>>, TError, {
    id: string;
}, TContext>;
/**
 * @summary Get signed download URL for file
 */
export declare const getGetFileUrlUrl: (id: string) => string;
export declare const getFileUrl: (id: string, options?: RequestInit) => Promise<FileUrl>;
export declare const getGetFileUrlQueryKey: (id: string) => readonly [`/api/files/${string}/url`];
export declare const getGetFileUrlQueryOptions: <TData = Awaited<ReturnType<typeof getFileUrl>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getFileUrl>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getFileUrl>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetFileUrlQueryResult = NonNullable<Awaited<ReturnType<typeof getFileUrl>>>;
export type GetFileUrlQueryError = ErrorType<unknown>;
/**
 * @summary Get signed download URL for file
 */
export declare function useGetFileUrl<TData = Awaited<ReturnType<typeof getFileUrl>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getFileUrl>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Upload a signature
 */
export declare const getCreateSignatureUrl: () => string;
export declare const createSignature: (createSignatureBody: CreateSignatureBody, options?: RequestInit) => Promise<Signature>;
export declare const getCreateSignatureMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createSignature>>, TError, {
        data: BodyType<CreateSignatureBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createSignature>>, TError, {
    data: BodyType<CreateSignatureBody>;
}, TContext>;
export type CreateSignatureMutationResult = NonNullable<Awaited<ReturnType<typeof createSignature>>>;
export type CreateSignatureMutationBody = BodyType<CreateSignatureBody>;
export type CreateSignatureMutationError = ErrorType<unknown>;
/**
 * @summary Upload a signature
 */
export declare const useCreateSignature: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createSignature>>, TError, {
        data: BodyType<CreateSignatureBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createSignature>>, TError, {
    data: BodyType<CreateSignatureBody>;
}, TContext>;
/**
 * @summary Get signatures for a job
 */
export declare const getGetJobSignaturesUrl: (jobId: string) => string;
export declare const getJobSignatures: (jobId: string, options?: RequestInit) => Promise<Signature[]>;
export declare const getGetJobSignaturesQueryKey: (jobId: string) => readonly [`/api/signatures/job/${string}`];
export declare const getGetJobSignaturesQueryOptions: <TData = Awaited<ReturnType<typeof getJobSignatures>>, TError = ErrorType<unknown>>(jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getJobSignatures>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getJobSignatures>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetJobSignaturesQueryResult = NonNullable<Awaited<ReturnType<typeof getJobSignatures>>>;
export type GetJobSignaturesQueryError = ErrorType<unknown>;
/**
 * @summary Get signatures for a job
 */
export declare function useGetJobSignatures<TData = Awaited<ReturnType<typeof getJobSignatures>>, TError = ErrorType<unknown>>(jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getJobSignatures>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Global search
 */
export declare const getGlobalSearchUrl: (params: GlobalSearchParams) => string;
export declare const globalSearch: (params: GlobalSearchParams, options?: RequestInit) => Promise<SearchResults>;
export declare const getGlobalSearchQueryKey: (params?: GlobalSearchParams) => readonly ["/api/search", ...GlobalSearchParams[]];
export declare const getGlobalSearchQueryOptions: <TData = Awaited<ReturnType<typeof globalSearch>>, TError = ErrorType<unknown>>(params: GlobalSearchParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof globalSearch>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof globalSearch>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GlobalSearchQueryResult = NonNullable<Awaited<ReturnType<typeof globalSearch>>>;
export type GlobalSearchQueryError = ErrorType<unknown>;
/**
 * @summary Global search
 */
export declare function useGlobalSearch<TData = Awaited<ReturnType<typeof globalSearch>>, TError = ErrorType<unknown>>(params: GlobalSearchParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof globalSearch>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Get upcoming service due dates
 */
export declare const getGetUpcomingServicesUrl: () => string;
export declare const getUpcomingServices: (options?: RequestInit) => Promise<UpcomingService[]>;
export declare const getGetUpcomingServicesQueryKey: () => readonly ["/api/reports/upcoming-services"];
export declare const getGetUpcomingServicesQueryOptions: <TData = Awaited<ReturnType<typeof getUpcomingServices>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getUpcomingServices>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getUpcomingServices>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetUpcomingServicesQueryResult = NonNullable<Awaited<ReturnType<typeof getUpcomingServices>>>;
export type GetUpcomingServicesQueryError = ErrorType<unknown>;
/**
 * @summary Get upcoming service due dates
 */
export declare function useGetUpcomingServices<TData = Awaited<ReturnType<typeof getUpcomingServices>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getUpcomingServices>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Get overdue services
 */
export declare const getGetOverdueServicesUrl: () => string;
export declare const getOverdueServices: (options?: RequestInit) => Promise<UpcomingService[]>;
export declare const getGetOverdueServicesQueryKey: () => readonly ["/api/reports/overdue-services"];
export declare const getGetOverdueServicesQueryOptions: <TData = Awaited<ReturnType<typeof getOverdueServices>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getOverdueServices>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getOverdueServices>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetOverdueServicesQueryResult = NonNullable<Awaited<ReturnType<typeof getOverdueServices>>>;
export type GetOverdueServicesQueryError = ErrorType<unknown>;
/**
 * @summary Get overdue services
 */
export declare function useGetOverdueServices<TData = Awaited<ReturnType<typeof getOverdueServices>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getOverdueServices>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Get completed jobs grouped by technician
 */
export declare const getGetCompletedByTechnicianUrl: (params?: GetCompletedByTechnicianParams) => string;
export declare const getCompletedByTechnician: (params?: GetCompletedByTechnicianParams, options?: RequestInit) => Promise<TechnicianStats[]>;
export declare const getGetCompletedByTechnicianQueryKey: (params?: GetCompletedByTechnicianParams) => readonly ["/api/reports/completed-by-technician", ...GetCompletedByTechnicianParams[]];
export declare const getGetCompletedByTechnicianQueryOptions: <TData = Awaited<ReturnType<typeof getCompletedByTechnician>>, TError = ErrorType<unknown>>(params?: GetCompletedByTechnicianParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCompletedByTechnician>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getCompletedByTechnician>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetCompletedByTechnicianQueryResult = NonNullable<Awaited<ReturnType<typeof getCompletedByTechnician>>>;
export type GetCompletedByTechnicianQueryError = ErrorType<unknown>;
/**
 * @summary Get completed jobs grouped by technician
 */
export declare function useGetCompletedByTechnician<TData = Awaited<ReturnType<typeof getCompletedByTechnician>>, TError = ErrorType<unknown>>(params?: GetCompletedByTechnicianParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCompletedByTechnician>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Get heat pump service record by job ID
 */
export declare const getGetHeatPumpServiceRecordByJobUrl: (jobId: string) => string;
export declare const getHeatPumpServiceRecordByJob: (jobId: string, options?: RequestInit) => Promise<HeatPumpServiceRecord>;
export declare const getGetHeatPumpServiceRecordByJobQueryKey: (jobId: string) => readonly [`/api/jobs/${string}/heat-pump-service`];
export declare const getGetHeatPumpServiceRecordByJobQueryOptions: <TData = Awaited<ReturnType<typeof getHeatPumpServiceRecordByJob>>, TError = ErrorType<unknown>>(jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getHeatPumpServiceRecordByJob>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getHeatPumpServiceRecordByJob>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetHeatPumpServiceRecordByJobQueryResult = NonNullable<Awaited<ReturnType<typeof getHeatPumpServiceRecordByJob>>>;
export type GetHeatPumpServiceRecordByJobQueryError = ErrorType<unknown>;
/**
 * @summary Get heat pump service record by job ID
 */
export declare function useGetHeatPumpServiceRecordByJob<TData = Awaited<ReturnType<typeof getHeatPumpServiceRecordByJob>>, TError = ErrorType<unknown>>(jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getHeatPumpServiceRecordByJob>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create heat pump service record for a job
 */
export declare const getCreateHeatPumpServiceRecordUrl: (jobId: string) => string;
export declare const createHeatPumpServiceRecord: (jobId: string, createHeatPumpServiceRecordBody: CreateHeatPumpServiceRecordBody, options?: RequestInit) => Promise<HeatPumpServiceRecord>;
export declare const getCreateHeatPumpServiceRecordMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createHeatPumpServiceRecord>>, TError, {
        jobId: string;
        data: BodyType<CreateHeatPumpServiceRecordBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createHeatPumpServiceRecord>>, TError, {
    jobId: string;
    data: BodyType<CreateHeatPumpServiceRecordBody>;
}, TContext>;
export type CreateHeatPumpServiceRecordMutationResult = NonNullable<Awaited<ReturnType<typeof createHeatPumpServiceRecord>>>;
export type CreateHeatPumpServiceRecordMutationBody = BodyType<CreateHeatPumpServiceRecordBody>;
export type CreateHeatPumpServiceRecordMutationError = ErrorType<unknown>;
/**
 * @summary Create heat pump service record for a job
 */
export declare const useCreateHeatPumpServiceRecord: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createHeatPumpServiceRecord>>, TError, {
        jobId: string;
        data: BodyType<CreateHeatPumpServiceRecordBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createHeatPumpServiceRecord>>, TError, {
    jobId: string;
    data: BodyType<CreateHeatPumpServiceRecordBody>;
}, TContext>;
/**
 * @summary Update heat pump service record for a job
 */
export declare const getUpdateHeatPumpServiceRecordUrl: (jobId: string) => string;
export declare const updateHeatPumpServiceRecord: (jobId: string, updateHeatPumpServiceRecordBody: UpdateHeatPumpServiceRecordBody, options?: RequestInit) => Promise<HeatPumpServiceRecord>;
export declare const getUpdateHeatPumpServiceRecordMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateHeatPumpServiceRecord>>, TError, {
        jobId: string;
        data: BodyType<UpdateHeatPumpServiceRecordBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateHeatPumpServiceRecord>>, TError, {
    jobId: string;
    data: BodyType<UpdateHeatPumpServiceRecordBody>;
}, TContext>;
export type UpdateHeatPumpServiceRecordMutationResult = NonNullable<Awaited<ReturnType<typeof updateHeatPumpServiceRecord>>>;
export type UpdateHeatPumpServiceRecordMutationBody = BodyType<UpdateHeatPumpServiceRecordBody>;
export type UpdateHeatPumpServiceRecordMutationError = ErrorType<unknown>;
/**
 * @summary Update heat pump service record for a job
 */
export declare const useUpdateHeatPumpServiceRecord: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateHeatPumpServiceRecord>>, TError, {
        jobId: string;
        data: BodyType<UpdateHeatPumpServiceRecordBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateHeatPumpServiceRecord>>, TError, {
    jobId: string;
    data: BodyType<UpdateHeatPumpServiceRecordBody>;
}, TContext>;
/**
 * @summary Get heat pump commissioning record by job ID
 */
export declare const getGetHeatPumpCommissioningRecordByJobUrl: (jobId: string) => string;
export declare const getHeatPumpCommissioningRecordByJob: (jobId: string, options?: RequestInit) => Promise<HeatPumpCommissioningRecord>;
export declare const getGetHeatPumpCommissioningRecordByJobQueryKey: (jobId: string) => readonly [`/api/jobs/${string}/heat-pump-commissioning`];
export declare const getGetHeatPumpCommissioningRecordByJobQueryOptions: <TData = Awaited<ReturnType<typeof getHeatPumpCommissioningRecordByJob>>, TError = ErrorType<unknown>>(jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getHeatPumpCommissioningRecordByJob>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getHeatPumpCommissioningRecordByJob>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetHeatPumpCommissioningRecordByJobQueryResult = NonNullable<Awaited<ReturnType<typeof getHeatPumpCommissioningRecordByJob>>>;
export type GetHeatPumpCommissioningRecordByJobQueryError = ErrorType<unknown>;
/**
 * @summary Get heat pump commissioning record by job ID
 */
export declare function useGetHeatPumpCommissioningRecordByJob<TData = Awaited<ReturnType<typeof getHeatPumpCommissioningRecordByJob>>, TError = ErrorType<unknown>>(jobId: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getHeatPumpCommissioningRecordByJob>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create heat pump commissioning record for a job
 */
export declare const getCreateHeatPumpCommissioningRecordUrl: (jobId: string) => string;
export declare const createHeatPumpCommissioningRecord: (jobId: string, createHeatPumpCommissioningRecordBody: CreateHeatPumpCommissioningRecordBody, options?: RequestInit) => Promise<HeatPumpCommissioningRecord>;
export declare const getCreateHeatPumpCommissioningRecordMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createHeatPumpCommissioningRecord>>, TError, {
        jobId: string;
        data: BodyType<CreateHeatPumpCommissioningRecordBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createHeatPumpCommissioningRecord>>, TError, {
    jobId: string;
    data: BodyType<CreateHeatPumpCommissioningRecordBody>;
}, TContext>;
export type CreateHeatPumpCommissioningRecordMutationResult = NonNullable<Awaited<ReturnType<typeof createHeatPumpCommissioningRecord>>>;
export type CreateHeatPumpCommissioningRecordMutationBody = BodyType<CreateHeatPumpCommissioningRecordBody>;
export type CreateHeatPumpCommissioningRecordMutationError = ErrorType<unknown>;
/**
 * @summary Create heat pump commissioning record for a job
 */
export declare const useCreateHeatPumpCommissioningRecord: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createHeatPumpCommissioningRecord>>, TError, {
        jobId: string;
        data: BodyType<CreateHeatPumpCommissioningRecordBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createHeatPumpCommissioningRecord>>, TError, {
    jobId: string;
    data: BodyType<CreateHeatPumpCommissioningRecordBody>;
}, TContext>;
/**
 * @summary Update heat pump commissioning record for a job
 */
export declare const getUpdateHeatPumpCommissioningRecordUrl: (jobId: string) => string;
export declare const updateHeatPumpCommissioningRecord: (jobId: string, updateHeatPumpCommissioningRecordBody: UpdateHeatPumpCommissioningRecordBody, options?: RequestInit) => Promise<HeatPumpCommissioningRecord>;
export declare const getUpdateHeatPumpCommissioningRecordMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateHeatPumpCommissioningRecord>>, TError, {
        jobId: string;
        data: BodyType<UpdateHeatPumpCommissioningRecordBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateHeatPumpCommissioningRecord>>, TError, {
    jobId: string;
    data: BodyType<UpdateHeatPumpCommissioningRecordBody>;
}, TContext>;
export type UpdateHeatPumpCommissioningRecordMutationResult = NonNullable<Awaited<ReturnType<typeof updateHeatPumpCommissioningRecord>>>;
export type UpdateHeatPumpCommissioningRecordMutationBody = BodyType<UpdateHeatPumpCommissioningRecordBody>;
export type UpdateHeatPumpCommissioningRecordMutationError = ErrorType<unknown>;
/**
 * @summary Update heat pump commissioning record for a job
 */
export declare const useUpdateHeatPumpCommissioningRecord: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateHeatPumpCommissioningRecord>>, TError, {
        jobId: string;
        data: BodyType<UpdateHeatPumpCommissioningRecordBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateHeatPumpCommissioningRecord>>, TError, {
    jobId: string;
    data: BodyType<UpdateHeatPumpCommissioningRecordBody>;
}, TContext>;
export {};
//# sourceMappingURL=api.d.ts.map