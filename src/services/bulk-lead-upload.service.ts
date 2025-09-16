import { Types } from "mongoose";
import Lead from "../models/lead.model";
import { FollowUp, LeadDto, LeadLog, Task } from "../dtos/lead.dto";

interface ImportOptions {
  status_id?: Types.ObjectId | null;
  source_id?: Types.ObjectId | null;
  label_ids?: Types.ObjectId[];
  assigned_to?: Types.ObjectId | null;
  source_name?: string;
}
export interface BulkLeadInputDto {
  name: string;
  company_name: string;
  phone_number: string;
  email: string;
  address: string;
  comment: string;
  reference: string;
  logs?: LeadLog[];
  follow_ups?: FollowUp[];
  tasks?: Task[];
  status?: Types.ObjectId | null;
  labels?: Types.ObjectId[];
  assigned_to?: Types.ObjectId | null;
  assigned_by?: Types.ObjectId | null;
  meta?: Record<string, any>;
  property_id: Types.ObjectId;
}

const _bulkInsertLeadsService = async (
  leadsData: BulkLeadInputDto[],
  ip: string
): Promise<(LeadDto & { _id: Types.ObjectId })[]> => {
  try {
    if (!leadsData.length) {
      throw new Error("No lead data provided for bulk insert");
    }

    // Prepare leads with metadata and ensure all required fields
    const leadsWithMetadata = leadsData.map((lead) => ({
      ...lead,
      logs: lead.logs || [],
      follow_ups: lead.follow_ups || [],
      tasks: lead.tasks || [],
      status: lead.status || null,
      labels: lead.labels || [],
      assigned_to: lead.assigned_to || null,
      assigned_by: lead.assigned_by || null,
      meta: {
        ...lead.meta,
        imported_at: new Date(),
        imported_ip: ip,
        bulk_import: true,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      ip_address: ip,
    }));

    const result = await Lead.insertMany(leadsWithMetadata, {
      ordered: false, // Continue inserting even if some documents fail
    });

    console.log(`Bulk insert completed: ${result.length} leads inserted`);

    if (result.length === 0) {
      throw new Error("No leads were inserted during bulk operation");
    }

    // Return the inserted documents - result is an array of inserted documents
    return result as (LeadDto & { _id: Types.ObjectId })[];
  } catch (error: any) {
    console.error("Bulk insert error:", error);

    if (error.code === 11000) {
      console.warn("Duplicate leads detected during bulk insert");
      throw new Error("Some leads already exist in the system");
    }

    throw new Error(`Bulk insert failed: ${error.message}`);
  }
};

const bulkInsertLeadsWithValidation = async (
  leadsData: BulkLeadInputDto[],
  ip: string,
  propertyId: Types.ObjectId
): Promise<{
  success: number;
  failed: number;
  errors: Array<{ index: number; error: string }>;
  insertedLeads: any[];
}> => {
  const errors: Array<{ index: number; error: string }> = [];
  const validLeads: BulkLeadInputDto[] = [];

  leadsData.forEach((lead, index) => {
    try {
      if (!lead.name || !lead.name.trim()) {
        throw new Error("Lead name is required");
      }

      if (!lead.email && !lead.phone_number) {
        throw new Error("Email or phone number is required");
      }

      if (lead.email && !isValidEmail(lead.email)) {
        throw new Error("Invalid email format");
      }

      // Ensure property_id is set
      const validatedLead: BulkLeadInputDto = {
        ...lead,
        property_id: lead.property_id || propertyId,
      };

      validLeads.push(validatedLead);
    } catch (error: any) {
      errors.push({ index, error: error.message });
    }
  });

  if (validLeads.length === 0) {
    throw new Error("No valid leads to import after validation");
  }

  try {
    // Perform bulk insert
    const insertedLeads = await _bulkInsertLeadsService(validLeads, ip);

    return {
      success: insertedLeads.length,
      failed: errors.length,
      errors,
      insertedLeads,
    };
  } catch (error: any) {
    throw new Error(`Bulk insert failed after validation: ${error.message}`);
  }
};

// Helper function for email validation
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export { bulkInsertLeadsWithValidation, isValidEmail };
