import { FeatureLogsStatus, FeatureStatus } from "../dtos/feature.dto";
import Feature from "../models/feature.model";

const _createFeatureService = async (input: {
  title: string;
  description: string;
  status?: string;
  meta?: any;
}) => {
  try {
    // Prevent duplicates
    const existing = await Feature.findOne({ title: input.title.trim() });
    if (existing) {
      throw new Error("A feature with this title already exists");
    }

    // Create new feature
    const newFeature = await Feature.create({
      title: input.title,
      description: input.description,
      status: FeatureStatus.ACTIVE,
      meta: input.meta || {},
      logs: [
        {
          title: "Feature Created",
          description: `${input.title} created successfully`,
          status: FeatureLogsStatus.ACTIVE,
          meta: { source: "manual_creation_feature_service" },
        },
      ],
    });

    return {
      success: true,
      message: "Feature created successfully",
      data: newFeature,
    };
  } catch (error: any) {
    console.error("Error creating feature:", error);
    throw new Error(error.message || "Failed to create feature");
  }
};

export { _createFeatureService };
