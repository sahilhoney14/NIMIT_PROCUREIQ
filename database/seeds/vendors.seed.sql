-- Seed: vendors.seed.sql
-- Description: Default baseline vendor OEM records

INSERT INTO vendor_oem_masters (
    vendor_code, registration_date, vendor_name, legal_entity, commercial_role, year_of_incorporation,
    director_or_ceo_or_management_name, director_or_ceo_or_management_designation, director_or_ceo_or_management_mobile_no, director_or_ceo_or_management_email,
    sales_team_name, sales_team_contact, sales_team_email,
    accounts_team_name, accounts_team_contact, accounts_team_email,
    gst_number, pan_number, turnover_year_1, turnover_value_1,
    gst_document, pan_document, msme_document, itr_last_year_document, recommended_by, approved_by,
    office_address, office_contact_name, office_contact_number,
    bank_name, bank_account_no, bank_branch, bank_account_type, bank_ifsc,
    branch_office_1_address
) VALUES (
    'NEE2627V001', '2026-04-01', 'Shree Balaji Engineering Pvt. Ltd.', 'Private Limited', 'OEM / Manufacturer', '2015',
    'Rajesh Sharma', 'Managing Director', '9876543210', 'director@shreebalajieng.com',
    'Amit Verma', '9876543211', 'sales@shreebalajieng.com',
    'Suresh Patel', '9876543212', 'accounts@shreebalajieng.com',
    '24AAACS1429B1ZB', 'AAACS1429B', '2024-25', '12500000',
    'gst_shreebalaji.pdf', 'pan_shreebalaji.pdf', 'msme_shreebalaji.pdf', 'itr_shreebalaji.pdf', 'Procurement Dept', 'Admin',
    'Plot 12, GIDC Industrial Estate, Vadodara, Gujarat', 'Karan Mehta', '9876543213',
    'State Bank of India', '38492019482', 'Alkapuri Vadodara', 'CURRENT', 'SBIN0001234',
    'Branch 1, Ahmedabad, Gujarat'
) ON DUPLICATE KEY UPDATE vendor_name = VALUES(vendor_name);
