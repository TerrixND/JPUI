type Product = {
    id: string;
    name: string;
    image: string;
    popularity: number;
    createdAt: number;
    finish: "polished" | "raw";
};

export const PRODUCTS: Product[] = [
    { id: "b7c1f4c2-9d8a-4c12-91e3-44b91b29aa01", name: "Emerald Harmony Necklace", image: "/images/img1.png", popularity: 120, createdAt: 20240110, finish: "polished" },
    { id: "2", name: "Imperial Jade Ring", image: "/images/img2.png", popularity: 300, createdAt: 20240201, finish: "raw" },
    { id: "3", name: "Celestial Drop Earrings", image: "/images/img3.png", popularity: 220, createdAt: 20240315, finish: "polished" },
    { id: "4", name: "Serenity Jade Bracelet", image: "/images/img4.png", popularity: 180, createdAt: 20240402, finish: "raw" },
    { id: "5", name: "Golden Vein Jade Pendant", image: "/images/img1.png", popularity: 260, createdAt: 20240511, finish: "polished" },
    { id: "6", name: "Imperial Green Bangle", image: "/images/img2.png", popularity: 340, createdAt: 20240621, finish: "raw" },
    { id: "7", name: "Lotus Carved Jade Ring", image: "/images/img3.png", popularity: 150, createdAt: 20240709, finish: "polished" },
    { id: "8", name: "Harmony Stone Bracelet", image: "/images/img4.png", popularity: 210, createdAt: 20240814, finish: "raw" },
    { id: "9", name: "Dynasty Jade Pendant", image: "/images/img1.png", popularity: 390, createdAt: 20240901, finish: "polished" },
    { id: '10', name: "Eternal Glow Earrings", image: "/images/img2.png", popularity: 175, createdAt: 20240928, finish: "raw" },
    { id: '11', name: "Imperial Carved Necklace", image: "/images/img3.png", popularity: 285, createdAt: 20241016, finish: "polished" },
    { id: '12', name: "Serene Jade Drop Pendant", image: "/images/img4.png", popularity: 195, createdAt: 20241103, finish: "raw" },
    { id: '13', name: "Celestial Harmony Ring", image: "/images/img1.png", popularity: 410, createdAt: 20241201, finish: "polished" },
    { id: '14', name: "Golden Serenity Bangle", image: "/images/img2.png", popularity: 240, createdAt: 20241218, finish: "raw" },
    { id: '15', name: "Dynasty Glow Bracelet", image: "/images/img3.png", popularity: 320, createdAt: 20250105, finish: "polished" },
    { id: '16', name: "Emerald Lotus Earrings", image: "/images/img4.png", popularity: 205, createdAt: 20250122, finish: "raw" },
{ id: '17', name: "Imperial Harmony Pendant", image: "/images/img1.png", popularity: 275, createdAt: 20250210, finish: "polished" },
{ id: '18', name: "Jade Dynasty Ring", image: "/images/img2.png", popularity: 360, createdAt: 20250302, finish: "raw" },
{ id: '19', name: "Celestial Glow Necklace", image: "/images/img3.png", popularity: 190, createdAt: 20250325, finish: "polished" },
{ id: '20', name: "Golden Lotus Bracelet", image: "/images/img4.png", popularity: 230, createdAt: 20250414, finish: "raw" },
{ id: '21', name: "Emerald Crown Pendant", image: "/images/img1.png", popularity: 410, createdAt: 20250501, finish: "polished" },
{ id: '22', name: "Imperial Forest Ring", image: "/images/img2.png", popularity: 295, createdAt: 20250520, finish: "raw" },
{ id: '23', name: "Serenity Glow Earrings", image: "/images/img3.png", popularity: 160, createdAt: 20250608, finish: "polished" },
{ id: '24', name: "Jade Harmony Bangle", image: "/images/img4.png", popularity: 340, createdAt: 20250625, finish: "raw" },
{ id: '25', name: "Golden Dynasty Necklace", image: "/images/img1.png", popularity: 380, createdAt: 20250711, finish: "polished" },
{ id: '26', name: "Celestial Jade Bracelet", image: "/images/img2.png", popularity: 210, createdAt: 20250729, finish: "raw" },
{ id: '27', name: "Emerald Vein Ring", image: "/images/img3.png", popularity: 185, createdAt: 20250813, finish: "polished" },
{ id: '28', name: "Imperial Stone Pendant", image: "/images/img4.png", popularity: 325, createdAt: 20250902, finish: "raw" },
{ id: '29', name: "Serene Harmony Necklace", image: "/images/img1.png", popularity: 260, createdAt: 20250918, finish: "polished" },
{ id: '30', name: "Golden Glow Earrings", image: "/images/img2.png", popularity: 305, createdAt: 20251005, finish: "raw" },
{ id: '31', name: "Dynasty Lotus Bracelet", image: "/images/img3.png", popularity: 445, createdAt: 20251022, finish: "polished" },
{ id: '32', name: "Imperial Emerald Bangle", image: "/images/img4.png", popularity: 215, createdAt: 20251109, finish: "raw" },
];



/* ------------------------------------------------------------------ */
/*  Admin product list (matches Prisma Product model)                   */
/* ------------------------------------------------------------------ */

export type AdminProductMedia = {
  id: string;
  type: "IMAGE" | "VIDEO" | "PDF";
  url: string;
  isPrimary: boolean;
  createdAt: string;
};

export type AdminProduct = {
  id: string;
  sku: string;
  name: string | null;
  color: string | null;
  weight: number | null;
  length: number | null;
  depth: number | null;
  height: number | null;
  importDate: string | null;
  importId: string | null;
  fromCompanyId: string | null;
  visibility: "PUBLIC" | "PRIVATE" | "RESTRICTED";
  visibilityNote: string | null;
  tier: "STANDARD" | "PREMIUM" | "EXCLUSIVE";
  status: "AVAILABLE" | "RESERVED" | "SOLD" | "TRANSFER_PENDING";
  minCustomerTier: "REGULAR" | "VIP" | "ELITE" | null;
  sourceType: "OWNED" | "CONSIGNMENT";
  consignmentAgreementId: string | null;
  isArchived: boolean;
  submittedByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  media: AdminProductMedia[];
};

export const ADMIN_PRODUCTS: AdminProduct[] = [
  {
    id: "b7c1f4c2-9d8a-4c12-91e3-44b91b29aa01",
    sku: "JDE-IMP-2025-0001",
    name: "Imperial Jade Dragon Pendant",
    color: "Emerald Green",
    weight: 42.5,
    length: 58,
    depth: 12,
    height: 75,
    importDate: "2025-01-12T00:00:00.000Z",
    importId: "IMP-2025-TH-7781",
    fromCompanyId: "company-7788",
    visibility: "PRIVATE",
    visibilityNote: "Reserved for VIP preview event",
    tier: "PREMIUM",
    status: "AVAILABLE",
    minCustomerTier: "VIP",
    sourceType: "OWNED",
    consignmentAgreementId: null,
    isArchived: false,
    submittedByUserId: "user-9012",
    updatedByUserId: "user-9012",
    createdAt: "2025-01-12T09:21:00.000Z",
    updatedAt: "2025-02-01T14:12:00.000Z",
    media: [
      { id: "media-1", type: "IMAGE", url: "/images/img1.png", isPrimary: true, createdAt: "2025-01-12T09:30:00.000Z" },
      { id: "media-2", type: "IMAGE", url: "/images/img2.png", isPrimary: false, createdAt: "2025-01-12T09:31:00.000Z" },
      { id: "media-3", type: "IMAGE", url: "/images/img3.png", isPrimary: false, createdAt: "2025-01-12T09:31:00.000Z" },
      { id: "media-4", type: "VIDEO", url: "/videos/hero-2.mp4", isPrimary: false, createdAt: "2025-01-12T09:32:00.000Z" },
      { id: "media-5", type: "VIDEO", url: "/videos/hero-3.mp4", isPrimary: false, createdAt: "2025-01-12T09:32:00.000Z" },
    ],
  },
  {
    id: "a3e2d1b0-8c7f-4a56-b234-11a22b33cc44",
    sku: "JDE-CEL-2025-0002",
    name: "Celestial Drop Earrings",
    color: "Lavender Jade",
    weight: 18.3,
    length: 35,
    depth: 8,
    height: 42,
    importDate: "2025-02-05T00:00:00.000Z",
    importId: "IMP-2025-MM-3321",
    fromCompanyId: "company-7788",
    visibility: "PUBLIC",
    visibilityNote: null,
    tier: "STANDARD",
    status: "AVAILABLE",
    minCustomerTier: null,
    sourceType: "OWNED",
    consignmentAgreementId: null,
    isArchived: false,
    submittedByUserId: "user-9012",
    updatedByUserId: "user-9012",
    createdAt: "2025-02-05T10:00:00.000Z",
    updatedAt: "2025-02-10T08:45:00.000Z",
    media: [
      { id: "media-6", type: "IMAGE", url: "/images/img3.png", isPrimary: true, createdAt: "2025-02-05T10:10:00.000Z" },
      { id: "media-7", type: "IMAGE", url: "/images/img4.png", isPrimary: false, createdAt: "2025-02-05T10:11:00.000Z" },
    ],
  },
  {
    id: "c5d6e7f8-1234-5678-9abc-def012345678",
    sku: "JDE-SER-2025-0003",
    name: "Serenity Jade Bracelet",
    color: "Moss Green",
    weight: 65.0,
    length: 180,
    depth: 10,
    height: 14,
    importDate: "2025-01-20T00:00:00.000Z",
    importId: "IMP-2025-TH-4490",
    fromCompanyId: "company-3321",
    visibility: "RESTRICTED",
    visibilityNote: "Elite customers only — private collection",
    tier: "EXCLUSIVE",
    status: "RESERVED",
    minCustomerTier: "ELITE",
    sourceType: "CONSIGNMENT",
    consignmentAgreementId: "ca-9988-7766",
    isArchived: false,
    submittedByUserId: "user-5501",
    updatedByUserId: "user-9012",
    createdAt: "2025-01-20T11:30:00.000Z",
    updatedAt: "2025-02-18T16:20:00.000Z",
    media: [
      { id: "media-8", type: "IMAGE", url: "/images/img4.png", isPrimary: true, createdAt: "2025-01-20T11:40:00.000Z" },
      { id: "media-9", type: "IMAGE", url: "/images/img1.png", isPrimary: false, createdAt: "2025-01-20T11:41:00.000Z" },
      { id: "media-10", type: "VIDEO", url: "/videos/hero-4.mp4", isPrimary: false, createdAt: "2025-01-20T11:45:00.000Z" },
      { id: "media-11", type: "PDF", url: "/docs/appraisal.pdf", isPrimary: false, createdAt: "2025-01-20T11:50:00.000Z" },
    ],
  },
  {
    id: "d8e9f0a1-b2c3-4d5e-f6a7-b8c9d0e1f2a3",
    sku: "JDE-GOL-2025-0004",
    name: "Golden Vein Jade Pendant",
    color: "Gold-veined Green",
    weight: 38.7,
    length: 48,
    depth: 11,
    height: 62,
    importDate: "2025-03-01T00:00:00.000Z",
    importId: "IMP-2025-TH-5510",
    fromCompanyId: "company-7788",
    visibility: "PUBLIC",
    visibilityNote: null,
    tier: "PREMIUM",
    status: "SOLD",
    minCustomerTier: "VIP",
    sourceType: "OWNED",
    consignmentAgreementId: null,
    isArchived: false,
    submittedByUserId: "user-9012",
    updatedByUserId: "user-9012",
    createdAt: "2025-03-01T09:00:00.000Z",
    updatedAt: "2025-03-15T14:30:00.000Z",
    media: [
      { id: "media-12", type: "IMAGE", url: "/images/img1.png", isPrimary: true, createdAt: "2025-03-01T09:10:00.000Z" },
    ],
  },
  {
    id: "e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b",
    sku: "JDE-LOT-2025-0005",
    name: "Lotus Carved Jade Ring",
    color: "Deep Green",
    weight: 22.1,
    length: 20,
    depth: 8,
    height: 22,
    importDate: "2025-02-14T00:00:00.000Z",
    importId: "IMP-2025-MM-6612",
    fromCompanyId: "company-3321",
    visibility: "PUBLIC",
    visibilityNote: null,
    tier: "STANDARD",
    status: "AVAILABLE",
    minCustomerTier: null,
    sourceType: "OWNED",
    consignmentAgreementId: null,
    isArchived: false,
    submittedByUserId: "user-5501",
    updatedByUserId: "user-5501",
    createdAt: "2025-02-14T08:00:00.000Z",
    updatedAt: "2025-02-14T08:00:00.000Z",
    media: [
      { id: "media-13", type: "IMAGE", url: "/images/img2.png", isPrimary: true, createdAt: "2025-02-14T08:10:00.000Z" },
      { id: "media-14", type: "IMAGE", url: "/images/img3.png", isPrimary: false, createdAt: "2025-02-14T08:11:00.000Z" },
      { id: "media-15", type: "PDF", url: "/docs/certificate.pdf", isPrimary: false, createdAt: "2025-02-14T08:15:00.000Z" },
    ],
  },
  {
    id: "f6a7b8c9-d0e1-2f3a-4b5c-6d7e8f9a0b1c",
    sku: "JDE-DYN-2025-0006",
    name: "Dynasty Jade Pendant",
    color: "Imperial Green",
    weight: 55.0,
    length: 52,
    depth: 15,
    height: 70,
    importDate: null,
    importId: null,
    fromCompanyId: null,
    visibility: "PRIVATE",
    visibilityNote: "Pending authentication",
    tier: "EXCLUSIVE",
    status: "TRANSFER_PENDING",
    minCustomerTier: "ELITE",
    sourceType: "CONSIGNMENT",
    consignmentAgreementId: "ca-1122-3344",
    isArchived: false,
    submittedByUserId: "user-9012",
    updatedByUserId: "user-9012",
    createdAt: "2025-03-10T15:00:00.000Z",
    updatedAt: "2025-03-12T09:22:00.000Z",
    media: [],
  },
];

export const SAMPLE_PRODUCT = {
    id: "b7c1f4c2-9d8a-4c12-91e3-44b91b29aa01",
    sku: "JDE-IMP-2025-0001",

    name: "Imperial Jade Dragon Pendant",
    color: "Emerald Green",
    weight: 42.5,
    length: 58,
    depth: 12,
    height: 75,

    importDate: "2025-01-12T00:00:00.000Z",
    importId: "IMP-2025-TH-7781",
    fromCompanyId: "company-7788",

    visibility: "PRIVATE", // PUBLIC | PRIVATE | RESTRICTED
    visibilityNote: "Reserved for VIP preview event",

    tier: "PREMIUM", // STANDARD | PREMIUM | EXCLUSIVE
    status: "AVAILABLE", // AVAILABLE | RESERVED | SOLD | TRANSFER_PENDING

    minCustomerTier: "VIP", // REGULAR | VIP | ELITE

    sourceType: "OWNED", // OWNED | CONSIGNMENT

    consignmentAgreementId: null,
    consignmentAgreement: null,

    isArchived: false,
    archivedAt: null,

    submittedByUserId: "user-9012",
    updatedByUserId: "user-9012",

    createdAt: "2025-01-12T09:21:00.000Z",
    updatedAt: "2025-02-01T14:12:00.000Z",

    // -------------------------
    // Media
    // -------------------------
    media: [
        {
            id: "media-1",
            type: "IMAGE", // IMAGE | VIDEO
            url: "/images/img1.png",
            isPrimary: true,
            createdAt: "2025-01-12T09:30:00.000Z",
        },
        {
            id: "media-2",
            type: "IMAGE",
            url: "/images/img2.png",
            isPrimary: false,
            createdAt: "2025-01-12T09:31:00.000Z",
        },
        {
            id: "media-3",
            type: "IMAGE",
            url: "/images/img3.png",
            isPrimary: false,
            createdAt: "2025-01-12T09:31:00.000Z",
        },
        {
            id: "media-4",
            type: "VIDEO",
            url: "/videos/hero-2.mp4",
            isPrimary: false,
            createdAt: "2025-01-12T09:32:00.000Z",
        },
        {
            id: "media-5",
            type: "VIDEO",
            url: "/videos/hero-3.mp4",
            isPrimary: false,
            createdAt: "2025-01-12T09:32:00.000Z",
        },
    ],
// -------------------------
// Current Ownership
// -------------------------
currentOwnershipId: "ownership-1",
    currentOwnership: {
    id: "ownership-1",
        ownerId: "customer-5521",
        acquiredAt: "2025-01-15T10:00:00.000Z",
        ownershipType: "DIRECT_PURCHASE",
        createdAt: "2025-01-15T10:00:00.000Z",
},

// -------------------------
// Ownership History
// -------------------------
ownershipHistory: [
    {
        id: "ownership-1",
        ownerId: "customer-5521",
        acquiredAt: "2025-01-15T10:00:00.000Z",
        releasedAt: null,
    },
],

    // -------------------------
    // Access Control List
    // -------------------------
    accessList: [
    {
        id: "access-1",
        userId: "user-elite-1",
        grantedAt: "2025-01-13T08:00:00.000Z",
    },
],

    // -------------------------
    // Commission Policies
    // -------------------------
    commissionPolicies: [
    {
        id: "commission-1",
        ratePercent: 8.5,
        appliesTo: "SALE",
        createdAt: "2025-01-12T09:25:00.000Z",
    },
],

    // -------------------------
    // Inventory Requests
    // -------------------------
    inventoryRequests: [],

    // -------------------------
    // Sales
    // -------------------------
    sales: [],

    // -------------------------
    // Appointment Items
    // -------------------------
    appointmentItems: [],

    // -------------------------
    // Possessions
    // -------------------------
    possessions: [],

    // -------------------------
    // Auth Cards
    // -------------------------
    authCards: [
    {
        id: "auth-1",
        serialNumber: "AUTH-DRAGON-0001",
        issuedAt: "2025-01-12T09:40:00.000Z",
    },
],

    // -------------------------
    // Ownership Claims
    // -------------------------
    ownershipClaims: [],

    // -------------------------
    // Ownership Transfers
    // -------------------------
    ownershipTransfers: [],

    // -------------------------
    // Ownership OTPs
    // -------------------------
    ownershipOtps: [],
};