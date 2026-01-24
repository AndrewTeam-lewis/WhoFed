[
  {
    "table_name": "activity_log",
    "column_name": "id",
    "data_type": "uuid",
    "referenced_table_name": null,
    "referenced_column_name": null
  },
  {
    "table_name": "activity_log",
    "column_name": "pet_id",
    "data_type": "uuid",
    "referenced_table_name": "pets",
    "referenced_column_name": "id"
  },
  {
    "table_name": "activity_log",
    "column_name": "schedule_id",
    "data_type": "uuid",
    "referenced_table_name": "schedules",
    "referenced_column_name": "id"
  },
  {
    "table_name": "activity_log",
    "column_name": "user_id",
    "data_type": "uuid",
    "referenced_table_name": "profiles",
    "referenced_column_name": "id"
  },
  {
    "table_name": "activity_log",
    "column_name": "action_type",
    "data_type": "text",
    "referenced_table_name": null,
    "referenced_column_name": null
  },
  {
    "table_name": "activity_log",
    "column_name": "performed_at",
    "data_type": "timestamp with time zone",
    "referenced_table_name": null,
    "referenced_column_name": null
  },
  {
    "table_name": "household_members",
    "column_name": "household_id",
    "data_type": "uuid",
    "referenced_table_name": "households",
    "referenced_column_name": "id"
  },
  {
    "table_name": "household_members",
    "column_name": "user_id",
    "data_type": "uuid",
    "referenced_table_name": "profiles",
    "referenced_column_name": "id"
  },
  {
    "table_name": "household_members",
    "column_name": "is_active",
    "data_type": "boolean",
    "referenced_table_name": null,
    "referenced_column_name": null
  },
  {
    "table_name": "household_members",
    "column_name": "can_log",
    "data_type": "boolean",
    "referenced_table_name": null,
    "referenced_column_name": null
  },
  {
    "table_name": "household_members",
    "column_name": "can_edit",
    "data_type": "boolean",
    "referenced_table_name": null,
    "referenced_column_name": null
  },
  {
    "table_name": "households",
    "column_name": "id",
    "data_type": "uuid",
    "referenced_table_name": null,
    "referenced_column_name": null
  },
  {
    "table_name": "households",
    "column_name": "owner_id",
    "data_type": "uuid",
    "referenced_table_name": "profiles",
    "referenced_column_name": "id"
  },
  {
    "table_name": "households",
    "column_name": "subscription_status",
    "data_type": "text",
    "referenced_table_name": null,
    "referenced_column_name": null
  },
  {
    "table_name": "pets",
    "column_name": "id",
    "data_type": "uuid",
    "referenced_table_name": null,
    "referenced_column_name": null
  },
  {
    "table_name": "pets",
    "column_name": "household_id",
    "data_type": "uuid",
    "referenced_table_name": "households",
    "referenced_column_name": "id"
  },
  {
    "table_name": "pets",
    "column_name": "name",
    "data_type": "text",
    "referenced_table_name": null,
    "referenced_column_name": null
  },
  {
    "table_name": "pets",
    "column_name": "species",
    "data_type": "text",
    "referenced_table_name": null,
    "referenced_column_name": null
  },
  {
    "table_name": "pets",
    "column_name": "pet_timezone",
    "data_type": "text",
    "referenced_table_name": null,
    "referenced_column_name": null
  },
  {
    "table_name": "profiles",
    "column_name": "id",
    "data_type": "uuid",
    "referenced_table_name": "users",
    "referenced_column_name": "id"
  },
  {
    "table_name": "profiles",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "referenced_table_name": null,
    "referenced_column_name": null
  },
  {
    "table_name": "profiles",
    "column_name": "username",
    "data_type": "text",
    "referenced_table_name": null,
    "referenced_column_name": null
  },
  {
    "table_name": "profiles",
    "column_name": "first_name",
    "data_type": "text",
    "referenced_table_name": null,
    "referenced_column_name": null
  },
  {
    "table_name": "profiles",
    "column_name": "last_name",
    "data_type": "text",
    "referenced_table_name": null,
    "referenced_column_name": null
  },
  {
    "table_name": "profiles",
    "column_name": "phone",
    "data_type": "text",
    "referenced_table_name": null,
    "referenced_column_name": null
  },
  {
    "table_name": "profiles",
    "column_name": "email",
    "data_type": "text",
    "referenced_table_name": null,
    "referenced_column_name": null
  },
  {
    "table_name": "schedules",
    "column_name": "id",
    "data_type": "uuid",
    "referenced_table_name": null,
    "referenced_column_name": null
  },
  {
    "table_name": "schedules",
    "column_name": "pet_id",
    "data_type": "uuid",
    "referenced_table_name": "pets",
    "referenced_column_name": "id"
  },
  {
    "table_name": "schedules",
    "column_name": "task_type",
    "data_type": "text",
    "referenced_table_name": null,
    "referenced_column_name": null
  },
  {
    "table_name": "schedules",
    "column_name": "label",
    "data_type": "text",
    "referenced_table_name": null,
    "referenced_column_name": null
  },
  {
    "table_name": "schedules",
    "column_name": "dosage",
    "data_type": "text",
    "referenced_table_name": null,
    "referenced_column_name": null
  },
  {
    "table_name": "schedules",
    "column_name": "schedule_mode",
    "data_type": "text",
    "referenced_table_name": null,
    "referenced_column_name": null
  },
  {
    "table_name": "schedules",
    "column_name": "interval_hours",
    "data_type": "integer",
    "referenced_table_name": null,
    "referenced_column_name": null
  },
  {
    "table_name": "schedules",
    "column_name": "target_times",
    "data_type": "ARRAY",
    "referenced_table_name": null,
    "referenced_column_name": null
  },
  {
    "table_name": "schedules",
    "column_name": "is_enabled",
    "data_type": "boolean",
    "referenced_table_name": null,
    "referenced_column_name": null
  }
]