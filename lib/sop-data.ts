// SOP Data extracted from the Excel file
export const sopData = {
  2025: {
  "103 - Investment Hammad": [],
  "321 - Contract Salaries": [
    {
      "pointOfInvoice": "Any",
      "serviceType": "Salary",
      "referenceTemplate": "<InternalInvoice#>_<Frequency>_[Month Year]",
      "referenceExample": "TDE24001_Oct24",
      "descriptionTemplate": "<Department>_<Service>_<ShortTag>",
      "descriptionExample": "Operations_Salary_<ShortTag>",
      "note": "For active contract employees i.e. general staff"
    },
    {
      "pointOfInvoice": "Any",
      "serviceType": "Compensation",
      "referenceTemplate": "<InternalInvoice#>_<Frequency>_[Month Year]",
      "referenceExample": "TDE24002_Oct24",
      "descriptionTemplate": "<Department>_<Service>_<ShortTag>",
      "descriptionExample": "Sales_Compensation_<ShortTag>",
      "note": "For passive services, or retainer services i.e. board advisor"
    },
    {
      "pointOfInvoice": "Any",
      "serviceType": "Freelance",
      "referenceTemplate": "<InternalInvoice#>_<Frequency>_[Month Year]",
      "referenceExample": "TDE24003_Oct24",
      "descriptionTemplate": "<Department>_<Service>_<ShortTag>",
      "descriptionExample": "Marketing_Freelance_<ShortTag>",
      "note": "For freelance services, not considered as permanent employees"
    }
  ],
  "325 - Research & Development": [
    {
      "pointOfInvoice": "DataDive",
      "serviceType": "Research Subscription",
      "referenceTemplate": "<Invoice#>_[Month Year]",
      "referenceExample": "INV-9595_Dec24",
      "descriptionTemplate": "<Service>_<ShortTag>",
      "descriptionExample": "Research Subscription_Datadive Monthly",
      "note": "Recurring R&D expenses"
    },
    {
      "pointOfInvoice": "Any",
      "serviceType": "Research Expense",
      "referenceTemplate": "<Invoice#>",
      "referenceExample": "INV-48935",
      "descriptionTemplate": "<Service>_<ShortTag>",
      "descriptionExample": "Research Expense_Excel Course",
      "note": "One time expenses for R&D"
    }
  ],
  "331 - 3PL": [
    {
      "pointOfInvoice": "3PL",
      "serviceType": "Storage",
      "referenceTemplate": "<Invoice#>",
      "referenceExample": "Invoice119",
      "descriptionTemplate": "<SKU>_<Batch #>_<Service>_<ShortTag>",
      "descriptionExample": "CS 007_Batch 12_Storage_<ShortTag>",
      "note": "3PL storage charges"
    },
    {
      "pointOfInvoice": "3PL",
      "serviceType": "Internal Handling",
      "referenceTemplate": "<Invoice#>",
      "referenceExample": "Invoice119",
      "descriptionTemplate": "<SKU>_<Batch #>_<Service>_<ShortTag>",
      "descriptionExample": "CS 007_Batch 12_Internal Handling_<ShortTag>",
      "note": "handling costs incurred during internal storage"
    },
    {
      "pointOfInvoice": "3PL",
      "serviceType": "Container Unloading",
      "referenceTemplate": "<Invoice#>_<Vessel Name>_<Container #>_<Country Code>",
      "referenceExample": "VUK00003643_OOCL Spain_OOCU8157379_UK",
      "descriptionTemplate": "<SKU>_<Batch #>_<Service>_<ShortTag>",
      "descriptionExample": "CS 007_Batch 12_Container Unloading_<ShortTag>",
      "note": "container unloading at 3PL warehouse"
    },
    {
      "pointOfInvoice": "3PL",
      "serviceType": "Outbound Handling",
      "referenceTemplate": "<Invoice#>_<FBA Shipment Plan ID>_<Location>",
      "referenceExample": "Invoice1001468758_FBA15JNS7SYV_VGlobal",
      "descriptionTemplate": "<SKU>_<Batch #>_<Service>_<ShortTag>",
      "descriptionExample": "CS 007_Batch 12_Outbound Handling_<ShortTag>",
      "note": "all costs incurred inside 3PL as a result of sending land freight to amazon"
    }
  ],
  "332 - Land Freight": [
    {
      "pointOfInvoice": "Amazon Freight",
      "serviceType": "LTL/FTL",
      "referenceTemplate": "<Invoice#>_<FBA Shipment Plan ID>_<Location>",
      "referenceExample": "Invoice1001468758_FBA15JNS7SYV_VGlobal",
      "descriptionTemplate": "<SKU>_<Batch #>_<Service>_<ShortTag>",
      "descriptionExample": "CS 007_Batch 12_LTL_<ShortTag>",
      "note": "LTL or FTL shipments sent to amazon"
    }
  ],
  "330 - Manufacturing": [
    {
      "pointOfInvoice": "Manufacturer",
      "serviceType": "Production",
      "referenceTemplate": "<Invoice#>",
      "referenceExample": "PI-2406202",
      "descriptionTemplate": "<SKU>_<Batch #>_<Service>_<ShortTag>",
      "descriptionExample": "CS 007_Batch 12_Production_<ShortTag>",
      "note": "manufacturing cost for a batch of goods"
    },
    {
      "pointOfInvoice": "Manufacturer",
      "serviceType": "Production Gloves",
      "referenceTemplate": "<Invoice#>",
      "referenceExample": "PI-2406202",
      "descriptionTemplate": "<SKU>_<Batch #>_<Service>_<ShortTag>",
      "descriptionExample": "CS 007_Batch 12_Production Gloves_<ShortTag>",
      "note": "manufacturing cost for a batch of goods"
    },
    {
      "pointOfInvoice": "Manufacturer",
      "serviceType": "Production Box",
      "referenceTemplate": "<Invoice#>",
      "referenceExample": "PI-2406202",
      "descriptionTemplate": "<SKU>_<Batch #>_<Service>_<ShortTag>",
      "descriptionExample": "CS 007_Batch 12_Production Box_<ShortTag>",
      "note": "manufacturing cost for a batch of goods"
    },
    {
      "pointOfInvoice": "Inspector",
      "serviceType": "Inspection",
      "referenceTemplate": "<Invoice#>",
      "referenceExample": "002240057",
      "descriptionTemplate": "<SKU>_<Batch #>_<Service>_<ShortTag>",
      "descriptionExample": "CS 007_Batch 12_Inspection_<ShortTag>",
      "note": "inspection cost for a batch of goods"
    },
    {
      "pointOfInvoice": "Other",
      "serviceType": "Other",
      "referenceTemplate": "<Invoice#>",
      "referenceExample": "002240057",
      "descriptionTemplate": "Other_<ShortTag>",
      "descriptionExample": "Other_MoneyExchange",
      "note": "Other services that do not fall into any category"
    }
  ],
  "334 - Freight & Custom Duty": [
    {
      "pointOfInvoice": "Freight Forwarder",
      "serviceType": "Freight",
      "referenceTemplate": "<Invoice#>_<Vessel Name>_<Container #>_<Country Code>",
      "referenceExample": "VUK00003643_OOCL Spain_OOCU8157379_UK",
      "descriptionTemplate": "<SKU>_<Batch #>_<Service>_<ShortTag>",
      "descriptionExample": "CS 007_Batch 12_Freight_<ShortTag>",
      "note": "freight, documentation and all related costs"
    },
    {
      "pointOfInvoice": "Freight Forwarder",
      "serviceType": "Customs Duty",
      "referenceTemplate": "<Invoice#>_<Vessel Name>_<Container #>_<Country Code>",
      "referenceExample": "VUK00003643_OOCL Spain_OOCU8157379_UK",
      "descriptionTemplate": "<SKU>_<Batch #>_<Service>_<ShortTag>",
      "descriptionExample": "CS 007_Batch 12_Customs Duty_<ShortTag>",
      "note": "customs duty charged at the port"
    }
  ],
  "401 - Accounting": [
    {
      "pointOfInvoice": "AMS, AVASK",
      "serviceType": "Tax Management",
      "referenceTemplate": "<Invoice#>_[Month Year]",
      "referenceExample": "INV-000935_Dec24",
      "descriptionTemplate": "<Region>_<Service>_<ShortTag>",
      "descriptionExample": "UK_Tax Management_<ShortTag>",
      "note": "Tax management includes bookkeeping, vat returns, tax returns, yearly accounts, CT etc."
    },
    {
      "pointOfInvoice": "Xero / Link My Books",
      "serviceType": "Software Subscription",
      "referenceTemplate": "<Invoice#>_[Month Year]",
      "referenceExample": "INV-4004_Dec24",
      "descriptionTemplate": "<Service>_<ShortTag>",
      "descriptionExample": "Software Subscription_<ShortTag>",
      "note": "Software subscriptions strictly for accounting purposes"
    },
    {
      "pointOfInvoice": "Any",
      "serviceType": "Adhoc",
      "referenceTemplate": "<Invoice#>_[Month Year]",
      "referenceExample": "INV-4004_Dec24",
      "descriptionTemplate": "<Region>_<Service>_<ShortTag>",
      "descriptionExample": "UK_Adhoc_confirmation statement_<ShortTag>",
      "note": "One-off tasks (reviews, special projects, etc.)"
    }
  ],
  "429 - General Operating Expenses": [
    {
      "pointOfInvoice": "Any",
      "serviceType": "Adhoc",
      "referenceTemplate": "<Invoice#>",
      "referenceExample": "284755853",
      "descriptionTemplate": "<Department>_<Service>_<ShortTag>",
      "descriptionExample": "Admin_CourierCharges",
      "note": "General expenses catch all category"
    }
  ],
  "437 - Interest Paid": [
    {
      "pointOfInvoice": "Any",
      "serviceType": "Adhoc",
      "referenceTemplate": "<Invoice#>",
      "referenceExample": "284755853",
      "descriptionTemplate": "<Region>_<Service>_<ShortTag>",
      "descriptionExample": "UK_Adhoc_HMRC Interest",
      "note": "General expenses catch all category"
    }
  ],
  "441 - Legal and Compliance": [
    {
      "pointOfInvoice": "AVASK",
      "serviceType": "EPR",
      "referenceTemplate": "<Invoice#>",
      "referenceExample": "INV1000048826",
      "descriptionTemplate": "<Region>_<Service>_<ShortTag>",
      "descriptionExample": "FR_EPR_<ShortTag>",
      "note": "EPR Services"
    },
    {
      "pointOfInvoice": "UK IPO, USPTO",
      "serviceType": "Trademark",
      "referenceTemplate": "<Invoice#>",
      "referenceExample": "1024185088",
      "descriptionTemplate": "<Region>_<Service>_<ShortTag>",
      "descriptionExample": "UK_Trademark_<ShortTag>",
      "note": "Trademark Services"
    },
    {
      "pointOfInvoice": "Bestway, AMS, AVASK",
      "serviceType": "Adhoc",
      "referenceTemplate": "<Invoice#>",
      "referenceExample": "284755853",
      "descriptionTemplate": "<Region>_<Service>_<ShortTag>",
      "descriptionExample": "UK_Adhoc_Copyright",
      "note": "Any adhoc services"
    }
  ],
  "456 - Travel": [],
  "458 - Office Supplies": [],
  "459 - Overseas VAT": [
    {
      "pointOfInvoice": "Amazon de, fr",
      "serviceType": "Overseas VAT",
      "referenceTemplate": "<Invoice#>_<Frequency>_[Month Year]",
      "referenceExample": "eh3447hivi31gi3jq3vaoz66dh2geqhx_Monthly_Nov24",
      "descriptionTemplate": "<Region>_<Service>_<ShortTag>",
      "descriptionExample": "DE_Overseas VAT_AVASK Payment",
      "note": "Overseas VAT not claimed"
    }
  ],
  "460 - Subsistence": [],
  "463 - IT Software": [
    {
      "pointOfInvoice": "CaptainAMZ, DataDive",
      "serviceType": "Amazon Subscription",
      "referenceTemplate": "<Invoice#>_<Frequency>_[Month Year]",
      "referenceExample": "BB3039760018_Yearly_Dec24",
      "descriptionTemplate": "<Department>_<Service>_<ShortTag>",
      "descriptionExample": "Marketing_AmazonSubscription_<ShortTag>",
      "note": "For all subscriptions strictly related to amazon/store"
    },
    {
      "pointOfInvoice": "Chatgpt, Anithropic, Youtube, AWS, Google",
      "serviceType": "Operating Subscription",
      "referenceTemplate": "<Invoice#>_<Frequency>_[Month Year]",
      "referenceExample": "EUINGB24-5689827_Monthly_Dec24",
      "descriptionTemplate": "<Department>_<Service>_<ShortTag>",
      "descriptionExample": "Sales_OperatingSubscription_<ShortTag>",
      "note": "For all subscriptions strictly related to the operating subscriptions"
    }
  ],
  "489 - Telephone & Internet": [
    {
      "pointOfInvoice": "Skype, US Mobile",
      "serviceType": "Operating Subscription",
      "referenceTemplate": "<Invoice#>_<Frequency>_[Month Year]",
      "referenceExample": "EUINGB24-5689827_Monthly_Dec24",
      "descriptionTemplate": "<Department>_<Service>_<ShortTag>",
      "descriptionExample": "Sales_OperatingSubscription_<ShortTag>",
      "note": ""
    }
  ],
  "620 - Prepayments": [
    {
      "pointOfInvoice": "Manual Journal (Prepayment Release)",
      "serviceType": "Prepayment",
      "referenceTemplate": "<MJ#>",
      "referenceExample": "MJ-1234",
      "descriptionTemplate": "Follow existing format",
      "descriptionExample": "Follow existing format",
      "note": "For moving prepaid amounts from an asset account into expenses (e.g., monthly portion of an annual subscription). Use the MJ # as ref."
    }
  ],
  "814 - Wages Payable - Payroll": [],
  "820 - VAT": [
    {
      "pointOfInvoice": "HMRC",
      "serviceType": "VAT Paid",
      "referenceTemplate": "<Invoice#>",
      "referenceExample": "67734",
      "descriptionTemplate": "<Frequency>_<PeriodStartMonthYear>_<PeriodEndMonthYear>_<ShortTag>",
      "descriptionExample": "Quarterly_Jan25_Mar25",
      "note": "VAT Account, we just follow the template when making payments for payments received into vat account they use existing trx template"
    }
  ],
  "825 - PAYE & NIC Payable": [],
  "830 - Provision for Corporation Tax": [],
  "835 - Director's Loan Account": []
},
  2024: {
  "103 - Investment Hammad": [],
  "321 - Contract Salaries": [
    {
      "serviceType": "Compensation",
      "referenceTemplate": "<InternalInvoice#> - <PeriodMonthYear>",
      "referenceExample": "TDE24002 - Oct24",
      "descriptionTemplate": "<Department> - <Service> - <ShortTag>",
      "descriptionExample": "Sales - Compensation - <ShortTag>",
      "note": "For passive services, or retainer services i.e. board advisor"
    },
    {
      "serviceType": "Freelance",
      "referenceTemplate": "<InternalInvoice#> - <PeriodMonthYear>",
      "referenceExample": "TDE24003 - Oct24",
      "descriptionTemplate": "<Department> - <Service> - <ShortTag>",
      "descriptionExample": "Marketing - Freelance - <ShortTag>",
      "note": "For freelance services, not considered as permanent employees"
    },
    {
      "serviceType": "Salary",
      "referenceTemplate": "<InternalInvoice#> - <PeriodMonthYear>",
      "referenceExample": "TDE24001 - Oct24",
      "descriptionTemplate": "<Department> - <Service> - <ShortTag>",
      "descriptionExample": "Operations - Salary - <ShortTag>",
      "note": "For active contract employees i.e. general staff"
    }
  ],
  "325 - Research & Development": [
    {
      "serviceType": "Research Expense",
      "referenceTemplate": "<Invoice#>",
      "referenceExample": "INV-48935",
      "descriptionTemplate": "<Service> - <ShortTag>",
      "descriptionExample": "Research Expense - Excel Course",
      "note": "One time expenses for R&D"
    },
    {
      "serviceType": "Research Subscription",
      "referenceTemplate": "<Invoice#> - <PeriodMonthYear>",
      "referenceExample": "INV-9595 - Dec24",
      "descriptionTemplate": "<Service> - <ShortTag>",
      "descriptionExample": "Research Subscription - Datadive Monthly",
      "note": "Recurring R&D expenses"
    }
  ],
  "330 - Manufacturing": [
    {
      "serviceType": "Inspection",
      "referenceTemplate": "<Invoice#> - <Location>",
      "referenceExample": "002240057 - Bari Textiles",
      "descriptionTemplate": "<SKU> - <Batch #> - <Service> - <ShortTag>",
      "descriptionExample": "CS 007 - Batch 12 - Inspection - <ShortTag>",
      "note": "inspection cost for a batch of goods"
    },
    {
      "serviceType": "Production",
      "referenceTemplate": "<Invoice#> - <Location>",
      "referenceExample": "PI-2406202 - Jiangsu Guangyun Electromechanical Co., Ltd.",
      "descriptionTemplate": "<SKU> - <Batch #> - <Service> - <ShortTag>",
      "descriptionExample": "CS 007 - Batch 12 - Production - <ShortTag>",
      "note": "manufacturing cost for a batch of goods"
    },
    {
      "serviceType": "Production Box",
      "referenceTemplate": "<Invoice#> - <Location>",
      "referenceExample": "PI-2406202 - Jiangsu Guangyun Electromechanical Co., Ltd.",
      "descriptionTemplate": "<SKU> - <Batch #> - <Service> - <ShortTag>",
      "descriptionExample": "CS 007 - Batch 12 - Production Box - <ShortTag>",
      "note": "manufacturing cost for a batch of goods"
    },
    {
      "serviceType": "Production Gloves",
      "referenceTemplate": "<Invoice#> - <Location>",
      "referenceExample": "PI-2406202 - Jiangsu Guangyun Electromechanical Co., Ltd.",
      "descriptionTemplate": "<SKU> - <Batch #> - <Service> - <ShortTag>",
      "descriptionExample": "CS 007 - Batch 12 - Production Gloves - <ShortTag>",
      "note": "manufacturing cost for a batch of goods"
    }
  ],
  "331 - 3PL": [
    {
      "serviceType": "Internal Handling",
      "referenceTemplate": "<Invoice#>",
      "referenceExample": "Invoice119",
      "descriptionTemplate": "<SKU> - <Batch #> - <Service> - <ShortTag>",
      "descriptionExample": "CS 007 - Batch 12 - Internal Handling - <ShortTag>",
      "note": "handling costs incurred during internal storage"
    },
    {
      "serviceType": "Storage",
      "referenceTemplate": "<Invoice#>",
      "referenceExample": "Invoice119",
      "descriptionTemplate": "<SKU> - <Batch #> - <Service> - <ShortTag>",
      "descriptionExample": "CS 007 - Batch 12 - Storage - <ShortTag>",
      "note": "3PL storage charges"
    }
  ],
  "332 - Land Freight": [
    {
      "serviceType": "LTL/FTL",
      "referenceTemplate": "<Invoice#> - <FBA Shipment Plan ID> - <Location>",
      "referenceExample": "Invoice1001468758 - FBA15JNS7SYV - VGlobal",
      "descriptionTemplate": "<SKU> - <Batch #> - <Service> - <ShortTag>",
      "descriptionExample": "CS 007 - Batch 12 - LTL - <ShortTag>",
      "note": "LTL or FTL shipments sent to amazon"
    },
    {
      "serviceType": "Outbound Handling",
      "referenceTemplate": "<Invoice#> - <FBA Shipment Plan ID> - <Location>",
      "referenceExample": "Invoice1001468758 - FBA15JNS7SYV - VGlobal",
      "descriptionTemplate": "<SKU> - <Batch #> - <Service> - <ShortTag>",
      "descriptionExample": "CS 007 - Batch 12 - Outbound Handling - <ShortTag>",
      "note": "all costs incurred inside 3PL as a result of sending land freight to amazon"
    }
  ],
  "334 - Freight & Custom Duty": [
    {
      "serviceType": "Container Unloading",
      "referenceTemplate": "<Invoice#> - <Vessel Name> - <Container #> - <Country Code>",
      "referenceExample": "VUK00003643 - OOCL Spain - OOCU8157379 - UK",
      "descriptionTemplate": "<SKU> - <Batch #> - <Service> - <ShortTag>",
      "descriptionExample": "CS 007 - Batch 12 - Container Unloading - <ShortTag>",
      "note": "container unloading at 3PL warehouse"
    },
    {
      "serviceType": "Customs Duty",
      "referenceTemplate": "<Invoice#> - <Vessel Name> - <Container #> - <Country Code>",
      "referenceExample": "VUK00003643 - OOCL Spain - OOCU8157379 - UK",
      "descriptionTemplate": "<SKU> - <Batch #> - <Service> - <ShortTag>",
      "descriptionExample": "CS 007 - Batch 12 - Customs Duty - <ShortTag>",
      "note": "customs duty charged at the port"
    },
    {
      "serviceType": "Freight",
      "referenceTemplate": "<Invoice#> - <Vessel Name> - <Container #> - <Country Code>",
      "referenceExample": "VUK00003643 - OOCL Spain - OOCU8157379 - UK",
      "descriptionTemplate": "<SKU> - <Batch #> - <Service> - <ShortTag>",
      "descriptionExample": "CS 007 - Batch 12 - Freight - <ShortTag>",
      "note": "freight, documentation and all related costs"
    }
  ],
  "401 - Accounting": [
    {
      "serviceType": "Adhoc",
      "referenceTemplate": "<Invoice#> - <PeriodMonthYear>",
      "referenceExample": "INV-4004 - Dec24",
      "descriptionTemplate": "<Region> - <Service> - <ShortTag>",
      "descriptionExample": "UK - Adhoc - confirmation statement - <ShortTag>",
      "note": "One-off tasks (reviews, special projects, etc.)"
    },
    {
      "serviceType": "Tax Management",
      "referenceTemplate": "<Invoice#> - <PeriodMonthYear>",
      "referenceExample": "INV-000935 - Dec24",
      "descriptionTemplate": "<Region> - <Service> - <ShortTag>",
      "descriptionExample": "UK - Tax Management - <ShortTag>",
      "note": "Tax management includes bookkeeping, vat returns, tax returns, yearly accounts, CT etc."
    },
    {
      "serviceType": "Software Subscription",
      "referenceTemplate": "<Invoice#> - <PeriodMonthYear>",
      "referenceExample": "INV-4004 - Dec24",
      "descriptionTemplate": "<Service> - <ShortTag>",
      "descriptionExample": "Software Subscription - <ShortTag>",
      "note": "Software subscriptions strictly for accounting purposes"
    }
  ],
  "429 - General Operating Expenses": [
    {
      "serviceType": "Adhoc",
      "referenceTemplate": "<Invoice#>",
      "referenceExample": "284755853",
      "descriptionTemplate": "<Department> - <Service> - <ShortTag>",
      "descriptionExample": "Admin - CourierCharges",
      "note": "General expenses catch all category"
    }
  ],
  "437 - Interest Paid": [
    {
      "serviceType": "Adhoc",
      "referenceTemplate": "<Invoice#>",
      "referenceExample": "284755853",
      "descriptionTemplate": "<Region> - <Service> - <ShortTag>",
      "descriptionExample": "UK - Adhoc - HMRC Interest",
      "note": "General expenses catch all category"
    }
  ],
  "441 - Legal and Compliance": [
    {
      "serviceType": "Adhoc",
      "referenceTemplate": "<Invoice#>",
      "referenceExample": "284755853",
      "descriptionTemplate": "<Region> - <Service> - <ShortTag>",
      "descriptionExample": "UK - Adhoc - Copyright",
      "note": "Any adhoc services"
    },
    {
      "serviceType": "EPR",
      "referenceTemplate": "<Invoice#>",
      "referenceExample": "INV1000048826",
      "descriptionTemplate": "<Region> - <Service> - <ShortTag>",
      "descriptionExample": "FR - EPR - <ShortTag>",
      "note": "EPR Services"
    },
    {
      "serviceType": "Trademark",
      "referenceTemplate": "<Invoice#>",
      "referenceExample": "1024185088",
      "descriptionTemplate": "<Region> - <Service> - <ShortTag>",
      "descriptionExample": "UK - Trademark - <ShortTag>",
      "note": "Trademark Services"
    }
  ],
  "456 - Travel": [],
  "458 - Office Supplies": [],
  "459 - Overseas VAT": [
    {
      "serviceType": "Overseas VAT",
      "referenceTemplate": "<Invoice#> - <Frequency> - <PeriodMonthYear>",
      "referenceExample": "eh3447hivi31gi3jq3vaoz66dh2geqhx - Monthly - Nov24",
      "descriptionTemplate": "<Region> - <Service> - <ShortTag>",
      "descriptionExample": "DE - Overseas VAT - AVASK Payment",
      "note": "Overseas VAT not claimed"
    }
  ],
  "460 - Subsistence": [],
  "463 - IT Software": [
    {
      "serviceType": "Amazon Subscription",
      "referenceTemplate": "<Invoice#> - <Frequency> - <PeriodMonthYear>",
      "referenceExample": "BB3039760018 - Yearly - Dec24",
      "descriptionTemplate": "<Department> - <Service> - <ShortTag>",
      "descriptionExample": "Marketing - AmazonSubscription - <ShortTag>",
      "note": "For all subscriptions strictly related to amazon/store"
    },
    {
      "serviceType": "Operating Subscription",
      "referenceTemplate": "<Invoice#> - <Frequency> - <PeriodMonthYear>",
      "referenceExample": "EUINGB24-5689827 - Monthly - Dec24",
      "descriptionTemplate": "<Department> - <Service> - <ShortTag>",
      "descriptionExample": "Sales - OperatingSubscription - <ShortTag>",
      "note": "For all subscriptions strictly related to the operating subscriptions"
    }
  ],
  "489 - Telephone & Internet": [
    {
      "serviceType": "Operating Subscription",
      "referenceTemplate": "<Invoice#> - <Frequency> - <PeriodMonthYear>",
      "referenceExample": "",
      "descriptionTemplate": "<Department> - <Service> - <ShortTag>",
      "descriptionExample": "",
      "note": ""
    }
  ],
  "620 - Prepayments": [
    {
      "serviceType": "Prepayment",
      "referenceTemplate": "<MJ#>",
      "referenceExample": "MJ-1234",
      "descriptionTemplate": "Follow existing format",
      "descriptionExample": "Follow existing format",
      "note": "For moving prepaid amounts from an asset account into expenses (e.g., monthly portion of an annual subscription). Use the MJ # as ref."
    }
  ],
  "710 - Office Equipment": [],
  "774 - Use of Home as Office": [],
  "814 - Wages Payable - Payroll": [],
  "820 - VAT": [
    {
      "serviceType": "VAT Paid",
      "referenceTemplate": "<Invoice#>",
      "referenceExample": "67734",
      "descriptionTemplate": "<Frequency> - <PeriodStartMonthYear> - <PeriodEndMonthYear> - <ShortTag>",
      "descriptionExample": "Quarterly - Jan25 - Mar25",
      "note": "VAT Account, we just follow the template when making payments for payments received into vat account they use existing trx template"
    }
  ],
  "825 - PAYE & NIC Payable": [],
  "830 - Provision for Corporation Tax": [],
  "835 - Director's Loan Account": []
}
}

export const rules = [
  "Reference for invoice level detail, common for all elements in a bill",
  "Description for line-item level detail, specific for a single element in a bill",
  "References will always start with <Invoice#>, and you can add other metadata as per requirement",
  "References template is same across a specific COA",
  "Costs are grouped by their nature, and not their point of billing",
  "Operating Expenses are always assigned a department via \"Tracking Codes\" option",
  "Point of Invoice column attempts to give you best examples for that type of transaction, it is not an exhaustive list",
  "_ is used as a standard separator, please make sure this does not appear inside invoice numbers etc."
]

export const chartOfAccounts = [
  {
    "code": "103",
    "name": "Investment Hammad"
  },
  {
    "code": "321",
    "name": "Contract Salaries"
  },
  {
    "code": "325",
    "name": "Research & Development"
  },
  {
    "code": "330",
    "name": "Manufacturing"
  },
  {
    "code": "331",
    "name": "3PL"
  },
  {
    "code": "332",
    "name": "Land Freight"
  },
  {
    "code": "334",
    "name": "Freight & Custom Duty"
  },
  {
    "code": "401",
    "name": "Accounting"
  },
  {
    "code": "429",
    "name": "General Operating Expenses"
  },
  {
    "code": "437",
    "name": "Interest Paid"
  },
  {
    "code": "441",
    "name": "Legal and Compliance"
  },
  {
    "code": "456",
    "name": "Travel"
  },
  {
    "code": "458",
    "name": "Office Supplies"
  },
  {
    "code": "459",
    "name": "Overseas VAT"
  },
  {
    "code": "460",
    "name": "Subsistence"
  },
  {
    "code": "463",
    "name": "IT Software"
  },
  {
    "code": "489",
    "name": "Telephone & Internet"
  },
  {
    "code": "620",
    "name": "Prepayments"
  },
  {
    "code": "710",
    "name": "Office Equipment"
  },
  {
    "code": "774",
    "name": "Use of Home as Office"
  },
  {
    "code": "814",
    "name": "Wages Payable - Payroll"
  },
  {
    "code": "820",
    "name": "VAT"
  },
  {
    "code": "825",
    "name": "PAYE & NIC Payable"
  },
  {
    "code": "830",
    "name": "Provision for Corporation Tax"
  },
  {
    "code": "835",
    "name": "Director's Loan Account"
  }
]

export const serviceTypes = {
  "Contract Salaries": [
    "Compensation",
    "Freelance",
    "Salary"
  ],
  "Research & Development": [
    "Research Expense",
    "Research Subscription"
  ],
  "Manufacturing": [
    "Inspection",
    "Other",
    "Production",
    "Production Box",
    "Production Gloves"
  ],
  "3PL": [
    "Container Unloading",
    "Internal Handling",
    "Outbound Handling",
    "Storage"
  ],
  "Land Freight": [
    "LTL/FTL",
    "Outbound Handling"
  ],
  "Freight & Custom Duty": [
    "Container Unloading",
    "Customs Duty",
    "Freight"
  ],
  "Accounting": [
    "Adhoc",
    "Software Subscription",
    "Tax Management"
  ],
  "General Operating Expenses": [
    "Adhoc"
  ],
  "Interest Paid": [
    "Adhoc"
  ],
  "Legal and Compliance": [
    "Adhoc",
    "EPR",
    "Trademark"
  ],
  "Overseas VAT": [
    "Overseas VAT"
  ],
  "IT Software": [
    "Amazon Subscription",
    "Operating Subscription"
  ],
  "Telephone & Internet": [
    "Operating Subscription"
  ],
  "Prepayments": [
    "Prepayment"
  ],
  "VAT": [
    "VAT Paid"
  ]
}

export const departments = [
  "Operations",
  "Sales",
  "Marketing",
  "Admin",
  "Finance",
  "HR",
  "IT"
]

export const regions = [
  "UK",
  "US",
  "EU",
  "DE",
  "FR",
  "ES",
  "IT"
]