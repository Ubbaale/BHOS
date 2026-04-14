import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from "@tanstack/react-query";
import type { ActivityItem, CreateDailyLogBody, CreateHomeBody, CreateIncidentBody, CreateMedicationAdministrationBody, CreateMedicationBody, CreatePatientBody, CreateShiftBody, CreateStaffBody, DailyLog, DashboardSummary, HealthStatus, Home, Incident, IncidentTrendItem, ListDailyLogsParams, ListIncidentsParams, ListMedicationAdministrationsParams, ListMedicationsParams, ListPatientsParams, ListShiftsParams, ListStaffParams, Medication, MedicationAdministration, MedicationComplianceItem, Patient, Shift, StaffMember, UpdateHomeBody, UpdateIncidentBody, UpdatePatientBody, UpdateShiftBody, UpdateStaffBody } from "./api.schemas";
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
 * @summary List all homes
 */
export declare const getListHomesUrl: () => string;
export declare const listHomes: (options?: RequestInit) => Promise<Home[]>;
export declare const getListHomesQueryKey: () => readonly ["/api/homes"];
export declare const getListHomesQueryOptions: <TData = Awaited<ReturnType<typeof listHomes>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listHomes>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listHomes>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListHomesQueryResult = NonNullable<Awaited<ReturnType<typeof listHomes>>>;
export type ListHomesQueryError = ErrorType<unknown>;
/**
 * @summary List all homes
 */
export declare function useListHomes<TData = Awaited<ReturnType<typeof listHomes>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listHomes>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create a new home
 */
export declare const getCreateHomeUrl: () => string;
export declare const createHome: (createHomeBody: CreateHomeBody, options?: RequestInit) => Promise<Home>;
export declare const getCreateHomeMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createHome>>, TError, {
        data: BodyType<CreateHomeBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createHome>>, TError, {
    data: BodyType<CreateHomeBody>;
}, TContext>;
export type CreateHomeMutationResult = NonNullable<Awaited<ReturnType<typeof createHome>>>;
export type CreateHomeMutationBody = BodyType<CreateHomeBody>;
export type CreateHomeMutationError = ErrorType<unknown>;
/**
 * @summary Create a new home
 */
export declare const useCreateHome: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createHome>>, TError, {
        data: BodyType<CreateHomeBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createHome>>, TError, {
    data: BodyType<CreateHomeBody>;
}, TContext>;
/**
 * @summary Get home by ID
 */
export declare const getGetHomeUrl: (id: number) => string;
export declare const getHome: (id: number, options?: RequestInit) => Promise<Home>;
export declare const getGetHomeQueryKey: (id: number) => readonly [`/api/homes/${number}`];
export declare const getGetHomeQueryOptions: <TData = Awaited<ReturnType<typeof getHome>>, TError = ErrorType<void>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getHome>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getHome>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetHomeQueryResult = NonNullable<Awaited<ReturnType<typeof getHome>>>;
export type GetHomeQueryError = ErrorType<void>;
/**
 * @summary Get home by ID
 */
export declare function useGetHome<TData = Awaited<ReturnType<typeof getHome>>, TError = ErrorType<void>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getHome>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update home
 */
export declare const getUpdateHomeUrl: (id: number) => string;
export declare const updateHome: (id: number, updateHomeBody: UpdateHomeBody, options?: RequestInit) => Promise<Home>;
export declare const getUpdateHomeMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateHome>>, TError, {
        id: number;
        data: BodyType<UpdateHomeBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateHome>>, TError, {
    id: number;
    data: BodyType<UpdateHomeBody>;
}, TContext>;
export type UpdateHomeMutationResult = NonNullable<Awaited<ReturnType<typeof updateHome>>>;
export type UpdateHomeMutationBody = BodyType<UpdateHomeBody>;
export type UpdateHomeMutationError = ErrorType<unknown>;
/**
 * @summary Update home
 */
export declare const useUpdateHome: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateHome>>, TError, {
        id: number;
        data: BodyType<UpdateHomeBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateHome>>, TError, {
    id: number;
    data: BodyType<UpdateHomeBody>;
}, TContext>;
/**
 * @summary List all staff
 */
export declare const getListStaffUrl: (params?: ListStaffParams) => string;
export declare const listStaff: (params?: ListStaffParams, options?: RequestInit) => Promise<StaffMember[]>;
export declare const getListStaffQueryKey: (params?: ListStaffParams) => readonly ["/api/staff", ...ListStaffParams[]];
export declare const getListStaffQueryOptions: <TData = Awaited<ReturnType<typeof listStaff>>, TError = ErrorType<unknown>>(params?: ListStaffParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listStaff>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listStaff>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListStaffQueryResult = NonNullable<Awaited<ReturnType<typeof listStaff>>>;
export type ListStaffQueryError = ErrorType<unknown>;
/**
 * @summary List all staff
 */
export declare function useListStaff<TData = Awaited<ReturnType<typeof listStaff>>, TError = ErrorType<unknown>>(params?: ListStaffParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listStaff>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create staff member
 */
export declare const getCreateStaffUrl: () => string;
export declare const createStaff: (createStaffBody: CreateStaffBody, options?: RequestInit) => Promise<StaffMember>;
export declare const getCreateStaffMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createStaff>>, TError, {
        data: BodyType<CreateStaffBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createStaff>>, TError, {
    data: BodyType<CreateStaffBody>;
}, TContext>;
export type CreateStaffMutationResult = NonNullable<Awaited<ReturnType<typeof createStaff>>>;
export type CreateStaffMutationBody = BodyType<CreateStaffBody>;
export type CreateStaffMutationError = ErrorType<unknown>;
/**
 * @summary Create staff member
 */
export declare const useCreateStaff: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createStaff>>, TError, {
        data: BodyType<CreateStaffBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createStaff>>, TError, {
    data: BodyType<CreateStaffBody>;
}, TContext>;
/**
 * @summary Get staff member by ID
 */
export declare const getGetStaffMemberUrl: (id: number) => string;
export declare const getStaffMember: (id: number, options?: RequestInit) => Promise<StaffMember>;
export declare const getGetStaffMemberQueryKey: (id: number) => readonly [`/api/staff/${number}`];
export declare const getGetStaffMemberQueryOptions: <TData = Awaited<ReturnType<typeof getStaffMember>>, TError = ErrorType<void>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getStaffMember>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getStaffMember>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetStaffMemberQueryResult = NonNullable<Awaited<ReturnType<typeof getStaffMember>>>;
export type GetStaffMemberQueryError = ErrorType<void>;
/**
 * @summary Get staff member by ID
 */
export declare function useGetStaffMember<TData = Awaited<ReturnType<typeof getStaffMember>>, TError = ErrorType<void>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getStaffMember>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update staff member
 */
export declare const getUpdateStaffUrl: (id: number) => string;
export declare const updateStaff: (id: number, updateStaffBody: UpdateStaffBody, options?: RequestInit) => Promise<StaffMember>;
export declare const getUpdateStaffMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateStaff>>, TError, {
        id: number;
        data: BodyType<UpdateStaffBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateStaff>>, TError, {
    id: number;
    data: BodyType<UpdateStaffBody>;
}, TContext>;
export type UpdateStaffMutationResult = NonNullable<Awaited<ReturnType<typeof updateStaff>>>;
export type UpdateStaffMutationBody = BodyType<UpdateStaffBody>;
export type UpdateStaffMutationError = ErrorType<unknown>;
/**
 * @summary Update staff member
 */
export declare const useUpdateStaff: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateStaff>>, TError, {
        id: number;
        data: BodyType<UpdateStaffBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateStaff>>, TError, {
    id: number;
    data: BodyType<UpdateStaffBody>;
}, TContext>;
/**
 * @summary List all patients
 */
export declare const getListPatientsUrl: (params?: ListPatientsParams) => string;
export declare const listPatients: (params?: ListPatientsParams, options?: RequestInit) => Promise<Patient[]>;
export declare const getListPatientsQueryKey: (params?: ListPatientsParams) => readonly ["/api/patients", ...ListPatientsParams[]];
export declare const getListPatientsQueryOptions: <TData = Awaited<ReturnType<typeof listPatients>>, TError = ErrorType<unknown>>(params?: ListPatientsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listPatients>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listPatients>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListPatientsQueryResult = NonNullable<Awaited<ReturnType<typeof listPatients>>>;
export type ListPatientsQueryError = ErrorType<unknown>;
/**
 * @summary List all patients
 */
export declare function useListPatients<TData = Awaited<ReturnType<typeof listPatients>>, TError = ErrorType<unknown>>(params?: ListPatientsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listPatients>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create patient
 */
export declare const getCreatePatientUrl: () => string;
export declare const createPatient: (createPatientBody: CreatePatientBody, options?: RequestInit) => Promise<Patient>;
export declare const getCreatePatientMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createPatient>>, TError, {
        data: BodyType<CreatePatientBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createPatient>>, TError, {
    data: BodyType<CreatePatientBody>;
}, TContext>;
export type CreatePatientMutationResult = NonNullable<Awaited<ReturnType<typeof createPatient>>>;
export type CreatePatientMutationBody = BodyType<CreatePatientBody>;
export type CreatePatientMutationError = ErrorType<unknown>;
/**
 * @summary Create patient
 */
export declare const useCreatePatient: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createPatient>>, TError, {
        data: BodyType<CreatePatientBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createPatient>>, TError, {
    data: BodyType<CreatePatientBody>;
}, TContext>;
/**
 * @summary Get patient by ID
 */
export declare const getGetPatientUrl: (id: number) => string;
export declare const getPatient: (id: number, options?: RequestInit) => Promise<Patient>;
export declare const getGetPatientQueryKey: (id: number) => readonly [`/api/patients/${number}`];
export declare const getGetPatientQueryOptions: <TData = Awaited<ReturnType<typeof getPatient>>, TError = ErrorType<void>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPatient>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPatient>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPatientQueryResult = NonNullable<Awaited<ReturnType<typeof getPatient>>>;
export type GetPatientQueryError = ErrorType<void>;
/**
 * @summary Get patient by ID
 */
export declare function useGetPatient<TData = Awaited<ReturnType<typeof getPatient>>, TError = ErrorType<void>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPatient>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update patient
 */
export declare const getUpdatePatientUrl: (id: number) => string;
export declare const updatePatient: (id: number, updatePatientBody: UpdatePatientBody, options?: RequestInit) => Promise<Patient>;
export declare const getUpdatePatientMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updatePatient>>, TError, {
        id: number;
        data: BodyType<UpdatePatientBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updatePatient>>, TError, {
    id: number;
    data: BodyType<UpdatePatientBody>;
}, TContext>;
export type UpdatePatientMutationResult = NonNullable<Awaited<ReturnType<typeof updatePatient>>>;
export type UpdatePatientMutationBody = BodyType<UpdatePatientBody>;
export type UpdatePatientMutationError = ErrorType<unknown>;
/**
 * @summary Update patient
 */
export declare const useUpdatePatient: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updatePatient>>, TError, {
        id: number;
        data: BodyType<UpdatePatientBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updatePatient>>, TError, {
    id: number;
    data: BodyType<UpdatePatientBody>;
}, TContext>;
/**
 * @summary List medications
 */
export declare const getListMedicationsUrl: (params?: ListMedicationsParams) => string;
export declare const listMedications: (params?: ListMedicationsParams, options?: RequestInit) => Promise<Medication[]>;
export declare const getListMedicationsQueryKey: (params?: ListMedicationsParams) => readonly ["/api/medications", ...ListMedicationsParams[]];
export declare const getListMedicationsQueryOptions: <TData = Awaited<ReturnType<typeof listMedications>>, TError = ErrorType<unknown>>(params?: ListMedicationsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listMedications>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listMedications>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListMedicationsQueryResult = NonNullable<Awaited<ReturnType<typeof listMedications>>>;
export type ListMedicationsQueryError = ErrorType<unknown>;
/**
 * @summary List medications
 */
export declare function useListMedications<TData = Awaited<ReturnType<typeof listMedications>>, TError = ErrorType<unknown>>(params?: ListMedicationsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listMedications>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create medication
 */
export declare const getCreateMedicationUrl: () => string;
export declare const createMedication: (createMedicationBody: CreateMedicationBody, options?: RequestInit) => Promise<Medication>;
export declare const getCreateMedicationMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createMedication>>, TError, {
        data: BodyType<CreateMedicationBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createMedication>>, TError, {
    data: BodyType<CreateMedicationBody>;
}, TContext>;
export type CreateMedicationMutationResult = NonNullable<Awaited<ReturnType<typeof createMedication>>>;
export type CreateMedicationMutationBody = BodyType<CreateMedicationBody>;
export type CreateMedicationMutationError = ErrorType<unknown>;
/**
 * @summary Create medication
 */
export declare const useCreateMedication: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createMedication>>, TError, {
        data: BodyType<CreateMedicationBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createMedication>>, TError, {
    data: BodyType<CreateMedicationBody>;
}, TContext>;
/**
 * @summary List medication administrations
 */
export declare const getListMedicationAdministrationsUrl: (params?: ListMedicationAdministrationsParams) => string;
export declare const listMedicationAdministrations: (params?: ListMedicationAdministrationsParams, options?: RequestInit) => Promise<MedicationAdministration[]>;
export declare const getListMedicationAdministrationsQueryKey: (params?: ListMedicationAdministrationsParams) => readonly ["/api/medication-administrations", ...ListMedicationAdministrationsParams[]];
export declare const getListMedicationAdministrationsQueryOptions: <TData = Awaited<ReturnType<typeof listMedicationAdministrations>>, TError = ErrorType<unknown>>(params?: ListMedicationAdministrationsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listMedicationAdministrations>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listMedicationAdministrations>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListMedicationAdministrationsQueryResult = NonNullable<Awaited<ReturnType<typeof listMedicationAdministrations>>>;
export type ListMedicationAdministrationsQueryError = ErrorType<unknown>;
/**
 * @summary List medication administrations
 */
export declare function useListMedicationAdministrations<TData = Awaited<ReturnType<typeof listMedicationAdministrations>>, TError = ErrorType<unknown>>(params?: ListMedicationAdministrationsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listMedicationAdministrations>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Record medication administration
 */
export declare const getCreateMedicationAdministrationUrl: () => string;
export declare const createMedicationAdministration: (createMedicationAdministrationBody: CreateMedicationAdministrationBody, options?: RequestInit) => Promise<MedicationAdministration>;
export declare const getCreateMedicationAdministrationMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createMedicationAdministration>>, TError, {
        data: BodyType<CreateMedicationAdministrationBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createMedicationAdministration>>, TError, {
    data: BodyType<CreateMedicationAdministrationBody>;
}, TContext>;
export type CreateMedicationAdministrationMutationResult = NonNullable<Awaited<ReturnType<typeof createMedicationAdministration>>>;
export type CreateMedicationAdministrationMutationBody = BodyType<CreateMedicationAdministrationBody>;
export type CreateMedicationAdministrationMutationError = ErrorType<unknown>;
/**
 * @summary Record medication administration
 */
export declare const useCreateMedicationAdministration: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createMedicationAdministration>>, TError, {
        data: BodyType<CreateMedicationAdministrationBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createMedicationAdministration>>, TError, {
    data: BodyType<CreateMedicationAdministrationBody>;
}, TContext>;
/**
 * @summary List incidents
 */
export declare const getListIncidentsUrl: (params?: ListIncidentsParams) => string;
export declare const listIncidents: (params?: ListIncidentsParams, options?: RequestInit) => Promise<Incident[]>;
export declare const getListIncidentsQueryKey: (params?: ListIncidentsParams) => readonly ["/api/incidents", ...ListIncidentsParams[]];
export declare const getListIncidentsQueryOptions: <TData = Awaited<ReturnType<typeof listIncidents>>, TError = ErrorType<unknown>>(params?: ListIncidentsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listIncidents>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listIncidents>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListIncidentsQueryResult = NonNullable<Awaited<ReturnType<typeof listIncidents>>>;
export type ListIncidentsQueryError = ErrorType<unknown>;
/**
 * @summary List incidents
 */
export declare function useListIncidents<TData = Awaited<ReturnType<typeof listIncidents>>, TError = ErrorType<unknown>>(params?: ListIncidentsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listIncidents>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Report an incident
 */
export declare const getCreateIncidentUrl: () => string;
export declare const createIncident: (createIncidentBody: CreateIncidentBody, options?: RequestInit) => Promise<Incident>;
export declare const getCreateIncidentMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createIncident>>, TError, {
        data: BodyType<CreateIncidentBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createIncident>>, TError, {
    data: BodyType<CreateIncidentBody>;
}, TContext>;
export type CreateIncidentMutationResult = NonNullable<Awaited<ReturnType<typeof createIncident>>>;
export type CreateIncidentMutationBody = BodyType<CreateIncidentBody>;
export type CreateIncidentMutationError = ErrorType<unknown>;
/**
 * @summary Report an incident
 */
export declare const useCreateIncident: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createIncident>>, TError, {
        data: BodyType<CreateIncidentBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createIncident>>, TError, {
    data: BodyType<CreateIncidentBody>;
}, TContext>;
/**
 * @summary Get incident by ID
 */
export declare const getGetIncidentUrl: (id: number) => string;
export declare const getIncident: (id: number, options?: RequestInit) => Promise<Incident>;
export declare const getGetIncidentQueryKey: (id: number) => readonly [`/api/incidents/${number}`];
export declare const getGetIncidentQueryOptions: <TData = Awaited<ReturnType<typeof getIncident>>, TError = ErrorType<void>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getIncident>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getIncident>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetIncidentQueryResult = NonNullable<Awaited<ReturnType<typeof getIncident>>>;
export type GetIncidentQueryError = ErrorType<void>;
/**
 * @summary Get incident by ID
 */
export declare function useGetIncident<TData = Awaited<ReturnType<typeof getIncident>>, TError = ErrorType<void>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getIncident>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update incident
 */
export declare const getUpdateIncidentUrl: (id: number) => string;
export declare const updateIncident: (id: number, updateIncidentBody: UpdateIncidentBody, options?: RequestInit) => Promise<Incident>;
export declare const getUpdateIncidentMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateIncident>>, TError, {
        id: number;
        data: BodyType<UpdateIncidentBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateIncident>>, TError, {
    id: number;
    data: BodyType<UpdateIncidentBody>;
}, TContext>;
export type UpdateIncidentMutationResult = NonNullable<Awaited<ReturnType<typeof updateIncident>>>;
export type UpdateIncidentMutationBody = BodyType<UpdateIncidentBody>;
export type UpdateIncidentMutationError = ErrorType<unknown>;
/**
 * @summary Update incident
 */
export declare const useUpdateIncident: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateIncident>>, TError, {
        id: number;
        data: BodyType<UpdateIncidentBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateIncident>>, TError, {
    id: number;
    data: BodyType<UpdateIncidentBody>;
}, TContext>;
/**
 * @summary List daily logs
 */
export declare const getListDailyLogsUrl: (params?: ListDailyLogsParams) => string;
export declare const listDailyLogs: (params?: ListDailyLogsParams, options?: RequestInit) => Promise<DailyLog[]>;
export declare const getListDailyLogsQueryKey: (params?: ListDailyLogsParams) => readonly ["/api/daily-logs", ...ListDailyLogsParams[]];
export declare const getListDailyLogsQueryOptions: <TData = Awaited<ReturnType<typeof listDailyLogs>>, TError = ErrorType<unknown>>(params?: ListDailyLogsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listDailyLogs>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listDailyLogs>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListDailyLogsQueryResult = NonNullable<Awaited<ReturnType<typeof listDailyLogs>>>;
export type ListDailyLogsQueryError = ErrorType<unknown>;
/**
 * @summary List daily logs
 */
export declare function useListDailyLogs<TData = Awaited<ReturnType<typeof listDailyLogs>>, TError = ErrorType<unknown>>(params?: ListDailyLogsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listDailyLogs>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create daily log
 */
export declare const getCreateDailyLogUrl: () => string;
export declare const createDailyLog: (createDailyLogBody: CreateDailyLogBody, options?: RequestInit) => Promise<DailyLog>;
export declare const getCreateDailyLogMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createDailyLog>>, TError, {
        data: BodyType<CreateDailyLogBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createDailyLog>>, TError, {
    data: BodyType<CreateDailyLogBody>;
}, TContext>;
export type CreateDailyLogMutationResult = NonNullable<Awaited<ReturnType<typeof createDailyLog>>>;
export type CreateDailyLogMutationBody = BodyType<CreateDailyLogBody>;
export type CreateDailyLogMutationError = ErrorType<unknown>;
/**
 * @summary Create daily log
 */
export declare const useCreateDailyLog: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createDailyLog>>, TError, {
        data: BodyType<CreateDailyLogBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createDailyLog>>, TError, {
    data: BodyType<CreateDailyLogBody>;
}, TContext>;
/**
 * @summary List shifts
 */
export declare const getListShiftsUrl: (params?: ListShiftsParams) => string;
export declare const listShifts: (params?: ListShiftsParams, options?: RequestInit) => Promise<Shift[]>;
export declare const getListShiftsQueryKey: (params?: ListShiftsParams) => readonly ["/api/shifts", ...ListShiftsParams[]];
export declare const getListShiftsQueryOptions: <TData = Awaited<ReturnType<typeof listShifts>>, TError = ErrorType<unknown>>(params?: ListShiftsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listShifts>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listShifts>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListShiftsQueryResult = NonNullable<Awaited<ReturnType<typeof listShifts>>>;
export type ListShiftsQueryError = ErrorType<unknown>;
/**
 * @summary List shifts
 */
export declare function useListShifts<TData = Awaited<ReturnType<typeof listShifts>>, TError = ErrorType<unknown>>(params?: ListShiftsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listShifts>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create shift
 */
export declare const getCreateShiftUrl: () => string;
export declare const createShift: (createShiftBody: CreateShiftBody, options?: RequestInit) => Promise<Shift>;
export declare const getCreateShiftMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createShift>>, TError, {
        data: BodyType<CreateShiftBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createShift>>, TError, {
    data: BodyType<CreateShiftBody>;
}, TContext>;
export type CreateShiftMutationResult = NonNullable<Awaited<ReturnType<typeof createShift>>>;
export type CreateShiftMutationBody = BodyType<CreateShiftBody>;
export type CreateShiftMutationError = ErrorType<unknown>;
/**
 * @summary Create shift
 */
export declare const useCreateShift: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createShift>>, TError, {
        data: BodyType<CreateShiftBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createShift>>, TError, {
    data: BodyType<CreateShiftBody>;
}, TContext>;
/**
 * @summary Update shift
 */
export declare const getUpdateShiftUrl: (id: number) => string;
export declare const updateShift: (id: number, updateShiftBody: UpdateShiftBody, options?: RequestInit) => Promise<Shift>;
export declare const getUpdateShiftMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateShift>>, TError, {
        id: number;
        data: BodyType<UpdateShiftBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateShift>>, TError, {
    id: number;
    data: BodyType<UpdateShiftBody>;
}, TContext>;
export type UpdateShiftMutationResult = NonNullable<Awaited<ReturnType<typeof updateShift>>>;
export type UpdateShiftMutationBody = BodyType<UpdateShiftBody>;
export type UpdateShiftMutationError = ErrorType<unknown>;
/**
 * @summary Update shift
 */
export declare const useUpdateShift: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateShift>>, TError, {
        id: number;
        data: BodyType<UpdateShiftBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateShift>>, TError, {
    id: number;
    data: BodyType<UpdateShiftBody>;
}, TContext>;
/**
 * @summary Get dashboard overview
 */
export declare const getGetDashboardSummaryUrl: () => string;
export declare const getDashboardSummary: (options?: RequestInit) => Promise<DashboardSummary>;
export declare const getGetDashboardSummaryQueryKey: () => readonly ["/api/dashboard/summary"];
export declare const getGetDashboardSummaryQueryOptions: <TData = Awaited<ReturnType<typeof getDashboardSummary>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDashboardSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getDashboardSummary>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetDashboardSummaryQueryResult = NonNullable<Awaited<ReturnType<typeof getDashboardSummary>>>;
export type GetDashboardSummaryQueryError = ErrorType<unknown>;
/**
 * @summary Get dashboard overview
 */
export declare function useGetDashboardSummary<TData = Awaited<ReturnType<typeof getDashboardSummary>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDashboardSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Get recent activity feed
 */
export declare const getGetRecentActivityUrl: () => string;
export declare const getRecentActivity: (options?: RequestInit) => Promise<ActivityItem[]>;
export declare const getGetRecentActivityQueryKey: () => readonly ["/api/dashboard/recent-activity"];
export declare const getGetRecentActivityQueryOptions: <TData = Awaited<ReturnType<typeof getRecentActivity>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getRecentActivity>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getRecentActivity>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetRecentActivityQueryResult = NonNullable<Awaited<ReturnType<typeof getRecentActivity>>>;
export type GetRecentActivityQueryError = ErrorType<unknown>;
/**
 * @summary Get recent activity feed
 */
export declare function useGetRecentActivity<TData = Awaited<ReturnType<typeof getRecentActivity>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getRecentActivity>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Get medication compliance stats per home
 */
export declare const getGetMedicationComplianceUrl: () => string;
export declare const getMedicationCompliance: (options?: RequestInit) => Promise<MedicationComplianceItem[]>;
export declare const getGetMedicationComplianceQueryKey: () => readonly ["/api/dashboard/medication-compliance"];
export declare const getGetMedicationComplianceQueryOptions: <TData = Awaited<ReturnType<typeof getMedicationCompliance>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMedicationCompliance>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getMedicationCompliance>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetMedicationComplianceQueryResult = NonNullable<Awaited<ReturnType<typeof getMedicationCompliance>>>;
export type GetMedicationComplianceQueryError = ErrorType<unknown>;
/**
 * @summary Get medication compliance stats per home
 */
export declare function useGetMedicationCompliance<TData = Awaited<ReturnType<typeof getMedicationCompliance>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMedicationCompliance>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Get incident trends over time
 */
export declare const getGetIncidentTrendsUrl: () => string;
export declare const getIncidentTrends: (options?: RequestInit) => Promise<IncidentTrendItem[]>;
export declare const getGetIncidentTrendsQueryKey: () => readonly ["/api/dashboard/incident-trends"];
export declare const getGetIncidentTrendsQueryOptions: <TData = Awaited<ReturnType<typeof getIncidentTrends>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getIncidentTrends>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getIncidentTrends>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetIncidentTrendsQueryResult = NonNullable<Awaited<ReturnType<typeof getIncidentTrends>>>;
export type GetIncidentTrendsQueryError = ErrorType<unknown>;
/**
 * @summary Get incident trends over time
 */
export declare function useGetIncidentTrends<TData = Awaited<ReturnType<typeof getIncidentTrends>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getIncidentTrends>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export {};
//# sourceMappingURL=api.d.ts.map