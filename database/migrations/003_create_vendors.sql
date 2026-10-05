-- Migration: 003_create_vendors.sql
-- Description: Creates vendor OEM master registry

CREATE TABLE IF NOT EXISTS vendor_oem_masters (
    vendor_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    vendor_code VARCHAR(50) DEFAULT NULL,
    registration_date DATE NOT NULL,
    vendor_name VARCHAR(255) NOT NULL,
    legal_entity TEXT NOT NULL,
    commercial_role TEXT NOT NULL,
    year_of_incorporation VARCHAR(20) NOT NULL,

    director_or_ceo_or_management_name TEXT NOT NULL,
    director_or_ceo_or_management_designation TEXT NOT NULL,
    director_or_ceo_or_management_mobile_no TEXT NOT NULL,
    director_or_ceo_or_management_email TEXT NOT NULL,
    director_or_ceo_or_management_web_address TEXT,

    sales_team_name TEXT NOT NULL,
    sales_team_contact TEXT NOT NULL,
    sales_team_email TEXT NOT NULL,

    accounts_team_name TEXT NOT NULL,
    accounts_team_contact TEXT NOT NULL,
    accounts_team_email TEXT NOT NULL,

    gst_number TEXT NOT NULL,
    pan_number TEXT NOT NULL,
    msme_number TEXT,

    turnover_year_1 VARCHAR(20) NOT NULL,
    turnover_value_1 VARCHAR(100) NOT NULL,
    turnover_year_2 VARCHAR(20) DEFAULT NULL,
    turnover_value_2 VARCHAR(100) DEFAULT NULL,
    turnover_year_3 VARCHAR(20) DEFAULT NULL,
    turnover_value_3 VARCHAR(100) DEFAULT NULL,

    gst_document TEXT NOT NULL,
    pan_document TEXT NOT NULL,
    msme_document TEXT,
    itr_last_year_document TEXT NOT NULL,
    itr_second_last_year_document TEXT,
    itr_third_last_year_document TEXT,

    recommended_by TEXT NOT NULL,
    approved_by TEXT NOT NULL,

    office_address TEXT,
    office_contact_name TEXT,
    office_contact_number TEXT,

    factory_address TEXT,
    factory_contact_name TEXT,
    factory_contact_number TEXT,

    warehouse_address TEXT,
    warehouse_contact_name TEXT,
    warehouse_contact_number TEXT,

    workshop_address TEXT,
    workshop_contact_name TEXT,
    workshop_contact_number TEXT,

    branch_office_1_address TEXT,
    branch_office_1_contact_name TEXT,
    branch_office_1_contact_number TEXT,

    branch_office_2_address TEXT,
    branch_office_2_contact_name TEXT,
    branch_office_2_contact_number TEXT,

    branch_office_3_address TEXT,
    branch_office_3_contact_name TEXT,
    branch_office_3_contact_number TEXT,

    bank_name TEXT,
    bank_account_no TEXT,
    branch TEXT,
    ifsc_code TEXT,
    account_type TEXT,
    cancelled_cheque_document TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (vendor_id),
    UNIQUE KEY uq_vendor_code (vendor_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
