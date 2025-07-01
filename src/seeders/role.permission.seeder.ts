import Permission, { PermissionDocument } from "../models/permission.model";
import Role from "../models/role.model";

export async function seedRolesAndPermissions() {
  const defaultPermissions = [
    { name: "manage_leads", description: "Manage all leads" },
    { name: "view_leads", description: "View leads" },
    { name: "call_leads", description: "Call leads" },
    { name: "manage_staff", description: "Manage staff members" },
    { name: "view_reports", description: "View reports and analytics" },
    {
      name: "manage_campaigns",
      description: "Create and manage marketing campaigns",
    },
    { name: "assign_leads", description: "Assign leads to agents or managers" },
    { name: "chat_with_leads", description: "Chat with potential leads" },
    { name: "manage_roles", description: "Create and manage user roles" },
    {
      name: "view_dashboard",
      description: "Access dashboard and summary data",
    },
    {
      name: "manage_sources_list",
      description: "Managing Source list in the platform",
    },
  ];

  const existingPermissions = await Permission.countDocuments();
  let createdPermissions: PermissionDocument[] = [];

  if (existingPermissions === 0) {
    createdPermissions = await Permission.insertMany(defaultPermissions);
  } else {
    createdPermissions = await Permission.find();
  }

  const permissionMap = Object.fromEntries(
    createdPermissions.map((p) => [p.name, p._id])
  );

  const roles = [
    {
      name: "Superadmin",
      description: "MR Group organisation employees",
      permissions: createdPermissions.map((p) => p._id),
    },
    {
      name: "Admin",
      description: "Any organisation's owner",
      permissions: [
        permissionMap["view_leads"],
        permissionMap["assign_leads"],
        permissionMap["manage_staff"],
        permissionMap["view_reports"],
        permissionMap["view_dashboard"],
        permissionMap["manage_campaigns"],
        permissionMap["manage_sources_list"],
      ],
    },
    {
      name: "Lead Manager",
      description: "Team lead managing staff and lead assignment",
      permissions: [
        permissionMap["view_leads"],
        permissionMap["assign_leads"],
        permissionMap["call_leads"],
        permissionMap["view_reports"],
      ],
    },
    {
      name: "Chat Agent",
      description: "Staff who interact directly with leads",
      permissions: [
        permissionMap["view_leads"],
        permissionMap["chat_with_leads"],
        permissionMap["call_leads"],
      ],
    },
  ];

  const existingRoles = await Role.countDocuments();
  if (existingRoles === 0) {
    await Role.insertMany(roles);
  }

  console.log("✅ Roles and Permissions Seeded Successfully");
}
