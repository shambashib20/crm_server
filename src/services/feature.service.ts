import { Types } from "mongoose";
import { FeatureLogsStatus, FeatureStatus } from "../dtos/feature.dto";
import Feature from "../models/feature.model";


interface UpdateFeatureInput {
  featureId: Types.ObjectId | string;
  title?: string;
  description?: string;
  status?: FeatureStatus;
  meta?: any;
}

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

const _fetchFeaturesService = async (
  is_table_view: boolean,
  page = 1,
  limit = 10
) => {
  try {
    let features: any[] = [];
    let total = 0;

    if (is_table_view) {
      total = await Feature.countDocuments();

      features = await Feature.find()
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean();

      return {
        items: features,
        pagination: {
          totalItems: total,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          limit,
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1,
        },
      };
    }

    // 🔹 Non-table view (no pagination)
    features = await Feature.find()
      .sort({ createdAt: -1 })
      .lean();

    return {
      items: features,
    };
  } catch (error) {
    console.error("Fetch Features Service Error:", error);
    throw error;
  }
};


const _updateFeatureService = async (input: UpdateFeatureInput) => {
  try {
    const { featureId, title, description, status, meta } = input;

    if (!Types.ObjectId.isValid(featureId)) {
      throw new Error("Invalid featureId");
    }

    const feature = await Feature.findById(featureId);
    if (!feature) {
      throw new Error("Feature not found");
    }

    if (title && title.trim() !== feature.title) {
      const existing = await Feature.findOne({
        title: title.trim(),
        _id: { $ne: featureId },
      });

      if (existing) {
        throw new Error("A feature with this title already exists");
      }
    }

    const updateSet: any = {};

    if (title) updateSet.title = title;
    if (description) updateSet.description = description;
    if (status) updateSet.status = status;
    if (meta) updateSet.meta = { ...feature.meta, ...meta };

    const logEntry = {
      title: "Feature Updated",
      description: `Feature "${feature.title}" was updated successfully`,
      status: FeatureLogsStatus.ACTIVE,
      meta: {
        updatedFields: Object.keys(updateSet),
        source: "manual_update_feature_service",
      },
    };

    const updatedFeature = await Feature.findByIdAndUpdate(
      featureId,
      {
        $set: updateSet,
        $push: { logs: logEntry },
      },
      {
        new: true,
        runValidators: true,
      }
    );
    return {
      success: true,
      message: "Feature updated successfully",
      data: updatedFeature,
    };
  } catch (error: any) {
    console.error("Error updating feature:", error);
    throw new Error(error.message || "Failed to update feature");
  }

}



export { _createFeatureService, _fetchFeaturesService, _updateFeatureService };
