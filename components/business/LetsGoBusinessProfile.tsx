import React, { useEffect, useState } from 'react';
import { Upload, TrendingUp, DollarSign, Clock, Users, Camera, Video, Settings, BarChart3, ChevronRight, Eye, CheckCircle, AlertCircle, Calendar, TrendingDown, Award, MapPin, Download, X, FileText, Mail, Bell, HelpCircle, Phone, MessageSquare, CreditCard } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { supabaseBrowser } from "@/lib/supabaseBrowser";




type AdCampaign = {
  name: string;
  price: string;        // "$599"
  description: string;
  color: string;        // hex
  featured?: boolean;
};

type BusinessEvent = {
  title: string;
  description: string;
  category: string;
  date: string;         // "January 10, 2026" (mock data format)
  time: string;         // "7:00 PM - 10:00 PM"
  price: string;        // "Free" or "$5 per card"
  capacity?: number;
  responses: { yes: number; maybe: number; no: number };
  image: string;
  bookingUrl?: string;
};

export default function LetsGoBusinessProfile({ businessId }: { businessId: string }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [profileImage, setProfileImage] = useState(null);

  // Color scheme
  const colors = {
    primary: '#14b8a6', // teal
    secondary: '#f97316', // orange
    accent: '#06b6d4', // cyan
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    purple: '#a855f7'
  };

  // View state for revenue chart
  const [revenueView, setRevenueView] = useState('30days'); // '30days', 'monthly', 'yearly'
  const [spendView, setSpendView] = useState('monthly'); // 'monthly', 'yearly'
  
  // Modal states
  const [showPhotoUploadModal, setShowPhotoUploadModal] = useState(false);
  const [showVideoUploadModal, setShowVideoUploadModal] = useState(false);
  const [showPlanChangeModal, setShowPlanChangeModal] = useState(false);
 const [selectedPlanChange, setSelectedPlanChange] = useState<"Basic" | "Premium" | null>(null);

  const [showLegalDisclaimerModal, setShowLegalDisclaimerModal] = useState(false);
  const [showAdDateModal, setShowAdDateModal] = useState(false);
 const [selectedAdCampaign, setSelectedAdCampaign] = useState<AdCampaign | null>(null);

  const [showAccountActionModal, setShowAccountActionModal] = useState(false);
  const [accountAction, setAccountAction] = useState(null); // 'delete', 'hold', 'reinstate'
  
const [effectivePlanNow, setEffectivePlanNow] = useState<string | null>(null);
const isPremium = effectivePlanNow === "premium";
const videosLocked = !isPremium;
const eventsLocked = !isPremium;
const adsLocked = !isPremium;


const premiumOnlyTabs = new Set(["advertising", "events"]);
const isTabLocked = (tabId: string) => !isPremium && premiumOnlyTabs.has(tabId);
const [invoice, setInvoice] = useState<any | null>(null);
const [invoiceLines, setInvoiceLines] = useState<any[]>([]);



  // TPMS Service
  const [tpmsEnabled, setTpmsEnabled] = useState(false);
  
  // Selected receipts for bulk actions
 const [selectedReceipts, setSelectedReceipts] = useState<string[]>([]);

  
  // Active advertising campaigns (upcoming/running)
  const activeAdCampaigns = [
    { id: 1, campaign: '7-Day Spotlight', startDate: 'Jan 15, 2025', endDate: 'Jan 21, 2025', cost: 599, status: 'Scheduled' }
  ];
  
  // Available tags for autocomplete — fetched from DB
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState(['bakery', 'fresh bread', 'pastries', 'custom cakes', 'coffee', 'breakfast', 'local']);
  const [tagInput, setTagInput] = useState('');
  const [filteredTags, setFilteredTags] = useState<string[]>([]);

  useEffect(() => {
    import("@/lib/availableTags").then(({ fetchAvailableTags }) => {
      fetchAvailableTags().then(setAvailableTags);
    });
  }, []);


  // Current subscription info
  const subscription = {
    plan: 'Premium',
    expires: 'March 15, 2025',
    addOns: ['Add 5 videos/day (+$50/month)', 'Increase live video capacity to 15 (+$50/month)'],
    addOnsTotal: 100 // Only add-ons, no premium fee on advertising page
  };

  // Advertising history
  const advertisingHistory = [
    { campaign: '7-Day Spotlight', startDate: 'Dec 1, 2024', endDate: 'Dec 7, 2024', cost: 599, clicks: 1247, conversions: 89 },
    { campaign: '1-Day Spotlight', startDate: 'Nov 15, 2024', endDate: 'Nov 15, 2024', cost: 99, clicks: 234, conversions: 18 },
    { campaign: '100 Mile Wide Push', startDate: 'Oct 20, 2024', endDate: 'Oct 26, 2024', cost: 2599, clicks: 4521, conversions: 312 }
  ];

  // Monthly advertising and add-on spend data
  const monthlySpendData = [
    { month: 'Jan', advertising: 599, addOns: 100 },
    { month: 'Feb', advertising: 0, addOns: 100 },
    { month: 'Mar', advertising: 99, addOns: 100 },
    { month: 'Apr', advertising: 0, addOns: 100 },
    { month: 'May', advertising: 599, addOns: 100 },
    { month: 'Jun', advertising: 0, addOns: 100 },
    { month: 'Jul', advertising: 2599, addOns: 100 },
    { month: 'Aug', advertising: 99, addOns: 100 },
    { month: 'Sep', advertising: 0, addOns: 100 },
    { month: 'Oct', advertising: 2599, addOns: 100 },
    { month: 'Nov', advertising: 99, addOns: 100 },
    { month: 'Dec', advertising: 599, addOns: 100 }
  ];

  // Yearly advertising and add-on spend data
  const yearlySpendData = [
    { year: '2022', advertising: 3200, addOns: 600 },
    { year: '2023', advertising: 5800, addOns: 1200 },
    { year: '2024', advertising: 7292, addOns: 1200 },
    { year: '2025', advertising: 599, addOns: 100 }
  ];

  // Video limits based on plan
  const videoLimits = {
    activeVideos: 5,
    maxActiveVideos: 10, // based on add-ons
    libraryVideos: 23,
    maxLibraryVideos: 50,
    pendingApproval: 3
  };

  // Pending video approvals
  const pendingVideos = [
    { user: 'Sarah M.', title: 'Amazing dinner experience!', uploadDate: '2 hours ago', thumbnail: '/api/placeholder/120/80' },
    { user: 'Mike R.', title: 'Best bakery in town', uploadDate: '5 hours ago', thumbnail: '/api/placeholder/120/80' },
    { user: 'Lisa K.', title: 'Love the atmosphere', uploadDate: '1 day ago', thumbnail: '/api/placeholder/120/80' }
  ];

  // Sample data - in real app would come from API
  const businessData = {
    name: 'J Skinner Baking',
    type: 'Restaurant/Bar',
    address: '14445 West Center Road, Springboro, AK 16435',
    phone: '(402) 515-0880',
    email: 'christopher.olson81@ymail.com',
    website: 'www.cheese.com',
    hours: {
      monday: { open: '09:00 AM', close: '05:00 PM' },
      tuesday: { open: '09:00 AM', close: '05:00 PM' },
      wednesday: { open: '09:00 AM', close: '05:00 PM' },
      thursday: { open: '09:00 AM', close: '05:00 PM' },
      friday: { open: '09:00 AM', close: '05:00 PM' },
      saturday: { open: '10:00 AM', close: '03:00 PM' },
      sunday: { open: 'Closed', close: '' }
    }
  };

  const analytics = {
    customersSent: 1247,
    totalRevenue: 64850.00,
    pendingApproval: 2890.50,
    avgTransaction: 52.03,
    monthlyGrowth: 23.5,
    receiptsProcessed: 1189,
    receiptsPending: 28,
    approvalRate: 95.8,
    repeatCustomerRate: 42.3,
    newCustomers: 89,
    returningCustomers: 158
  };

  // Revenue over time (last 30 days)
  const revenueData = [
    { date: 'Dec 1', revenue: 1850, customers: 38 },
    { date: 'Dec 3', revenue: 2100, customers: 42 },
    { date: 'Dec 5', revenue: 1920, customers: 35 },
    { date: 'Dec 7', revenue: 2450, customers: 48 },
    { date: 'Dec 9', revenue: 2280, customers: 44 },
    { date: 'Dec 11', revenue: 2650, customers: 52 },
    { date: 'Dec 13', revenue: 2320, customers: 46 },
    { date: 'Dec 15', revenue: 2890, customers: 58 },
    { date: 'Dec 17', revenue: 2520, customers: 49 },
    { date: 'Dec 19', revenue: 2750, customers: 54 },
    { date: 'Dec 21', revenue: 3100, customers: 62 },
    { date: 'Dec 23', revenue: 2940, customers: 57 },
    { date: 'Dec 25', revenue: 1850, customers: 35 },
    { date: 'Dec 27', revenue: 2680, customers: 53 },
    { date: 'Dec 29', revenue: 2920, customers: 56 },
    { date: 'Dec 31', revenue: 3200, customers: 65 }
  ];

  // Monthly revenue data
  const monthlyRevenueData = [
    { month: 'Jan', revenue: 45200, customers: 890 },
    { month: 'Feb', revenue: 48100, customers: 945 },
    { month: 'Mar', revenue: 52300, customers: 1024 },
    { month: 'Apr', revenue: 49800, customers: 978 },
    { month: 'May', revenue: 54600, customers: 1067 },
    { month: 'Jun', revenue: 58900, customers: 1156 },
    { month: 'Jul', revenue: 62400, customers: 1223 },
    { month: 'Aug', revenue: 59700, customers: 1171 },
    { month: 'Sep', revenue: 61200, customers: 1201 },
    { month: 'Oct', revenue: 63800, customers: 1252 },
    { month: 'Nov', revenue: 66500, customers: 1304 },
    { month: 'Dec', revenue: 64850, customers: 1247 }
  ];

  // Yearly revenue data
  const yearlyRevenueData = [
    { year: '2021', revenue: 482000, customers: 9450 },
    { year: '2022', revenue: 568000, customers: 11120 },
    { year: '2023', revenue: 634000, customers: 12430 },
    { year: '2024', revenue: 697250, customers: 13658 }
  ];

  // Receipt history with detailed breakdown
  const receiptHistory = [
    { 
      id: 'RCP-2024-1247', 
      customer: 'Sarah M.', 
      customerLevel: 4,
      date: '23 mins ago', 
      timestamp: new Date('2024-12-31 22:00'),
      subtotal: 68.50, 
      progressivePayout: 4.11, // 6% (Level 4)
      basicFee: 5.00,
      creditCardFee: 2.40,
      totalFees: 11.51,
      status: 'approved',
      receiptUrl: '#',
      receiptImage: '/api/placeholder/400/600'
    },
    { 
      id: 'RCP-2024-1246', 
      customer: 'John D.',
      customerLevel: 2, 
      date: '1 hour ago',
      timestamp: new Date('2024-12-31 21:30'), 
      subtotal: 42.30, 
      progressivePayout: 1.69, // 4% (Level 2)
      basicFee: 4.23,
      creditCardFee: 1.48,
      totalFees: 7.40,
      status: 'pending',
      receiptUrl: '#',
      receiptImage: '/api/placeholder/400/600'
    },
    { 
      id: 'RCP-2024-1245', 
      customer: 'Lisa K.',
      customerLevel: 6, 
      date: '2 hours ago',
      timestamp: new Date('2024-12-31 20:30'), 
      subtotal: 91.75, 
      progressivePayout: 7.34, // 8% (Level 6)
      basicFee: 5.00,
      creditCardFee: 3.21,
      totalFees: 15.55,
      status: 'approved',
      receiptUrl: '#',
      receiptImage: '/api/placeholder/400/600'
    },
    { 
      id: 'RCP-2024-1244', 
      customer: 'Mike R.',
      customerLevel: 7, 
      date: '3 hours ago',
      timestamp: new Date('2024-12-31 19:30'), 
      subtotal: 124.00, 
      progressivePayout: 12.40, // 10% (Level 7)
      basicFee: 5.00,
      creditCardFee: 4.34,
      totalFees: 21.74,
      status: 'approved',
      receiptUrl: '#',
      receiptImage: '/api/placeholder/400/600'
    },
    { 
      id: 'RCP-2024-1243', 
      customer: 'Emily W.',
      customerLevel: 1, 
      date: '4 hours ago',
      timestamp: new Date('2024-12-31 18:30'), 
      subtotal: 36.90, 
      progressivePayout: 1.11, // 3% (Level 1)
      basicFee: 3.69,
      creditCardFee: 1.29,
      totalFees: 6.09,
      status: 'approved',
      receiptUrl: '#',
      receiptImage: '/api/placeholder/400/600'
    }
  ];

  // Pending receipts for review
  const pendingReceipts = [
    {
      id: 'RCP-2024-1250',
      customer: 'Amanda T.',
      customerLevel: 3,
      date: '5 mins ago',
      timestamp: new Date('2024-12-31 22:18'),
      subtotal: 54.20,
      progressivePayout: 2.71, // 5% (Level 3)
      basicFee: 5.00,
      creditCardFee: 1.90,
      totalFees: 9.61,
      status: 'pending',
      receiptUrl: '#',
      receiptImage: '/api/placeholder/400/600'
    },
    {
      id: 'RCP-2024-1249',
      customer: 'Robert J.',
      customerLevel: 5,
      date: '12 mins ago',
      timestamp: new Date('2024-12-31 22:11'),
      subtotal: 78.90,
      progressivePayout: 5.52, // 7% (Level 5)
      basicFee: 5.00,
      creditCardFee: 2.76,
      totalFees: 13.28,
      status: 'pending',
      receiptUrl: '#',
      receiptImage: '/api/placeholder/400/600'
    },
    {
      id: 'RCP-2024-1248',
      customer: 'Jennifer L.',
      customerLevel: 2,
      date: '45 mins ago',
      timestamp: new Date('2024-12-31 21:38'),
      subtotal: 32.50,
      progressivePayout: 1.30, // 4% (Level 2)
      basicFee: 3.25,
      creditCardFee: 1.14,
      totalFees: 5.69,
      status: 'pending',
      receiptUrl: '#',
      receiptImage: '/api/placeholder/400/600'
    }
  ];

  // Progressive payout history
  const payoutHistory = [
    { date: 'Dec 15, 2024', amount: 2450.00, receipts: 52, status: 'Paid', method: 'ACH' },
    { date: 'Dec 1, 2024', amount: 2180.50, receipts: 48, status: 'Paid', method: 'ACH' },
    { date: 'Nov 15, 2024', amount: 2890.75, receipts: 61, status: 'Paid', method: 'ACH' },
    { date: 'Nov 1, 2024', amount: 2320.00, receipts: 49, status: 'Paid', method: 'ACH' },
    { date: 'Oct 15, 2024', amount: 2640.25, receipts: 56, status: 'Paid', method: 'ACH' }
  ];

  // Calculate total fees percentage
  const totalSubtotal = receiptHistory.reduce((sum, r) => sum + r.subtotal, 0);
  const totalFees = receiptHistory.reduce((sum, r) => sum + r.totalFees, 0);
  const effectiveFeePercentage = ((totalFees / totalSubtotal) * 100).toFixed(2);

  // Customer visits by day of week
  const weeklyData = [
    { day: 'Mon', visits: 156, revenue: 8120 },
    { day: 'Tue', visits: 142, revenue: 7380 },
    { day: 'Wed', visits: 168, revenue: 8740 },
    { day: 'Thu', visits: 189, revenue: 9830 },
    { day: 'Fri', visits: 234, revenue: 12180 },
    { day: 'Sat', visits: 267, revenue: 13890 },
    { day: 'Sun', visits: 91, revenue: 4730 }
  ];

  // Receipt status breakdown
  const receiptStatusData = [
    { name: 'Approved', value: 1089, color: colors.success },
    { name: 'Pending', value: 28, color: colors.warning },
    { name: 'Disputed', value: 12, color: colors.danger }
  ];

  // Peak hours data
  const peakHoursData = [
    { hour: '9AM', customers: 12 },
    { hour: '10AM', customers: 18 },
    { hour: '11AM', customers: 28 },
    { hour: '12PM', customers: 45 },
    { hour: '1PM', customers: 52 },
    { hour: '2PM', customers: 38 },
    { hour: '3PM', customers: 24 },
    { hour: '4PM', customers: 16 },
    { hour: '5PM', customers: 8 }
  ];

  // Customer tier distribution
  const customerTierData = [
    { tier: 'Level 1', customers: 342, color: '#94a3b8', revenue: 12480 },
    { tier: 'Level 2', customers: 289, color: '#64748b', revenue: 14230 },
    { tier: 'Level 3', customers: 198, color: colors.accent, revenue: 11560 },
    { tier: 'Level 4', customers: 156, color: colors.primary, revenue: 9890 },
    { tier: 'Level 5', customers: 124, color: colors.secondary, revenue: 8340 },
    { tier: 'Level 6', customers: 89, color: '#f59e0b', revenue: 6120 },
    { tier: 'Level 7', customers: 49, color: colors.success, revenue: 5230 }
  ];

  const mediaGallery = [
    { type: 'photo', url: '/api/placeholder/300/200', caption: 'Storefront view', isMainPhoto: true },
    { type: 'video', url: '/api/placeholder/300/200', caption: 'Menu highlights', isMainPhoto: false },
    { type: 'photo', url: '/api/placeholder/300/200', caption: 'Interior seating', isMainPhoto: false },
    { type: 'photo', url: '/api/placeholder/300/200', caption: 'Special dishes', isMainPhoto: false },
    { type: 'photo', url: '/api/placeholder/300/200', caption: 'Happy customers', isMainPhoto: false },
    { type: 'video', url: '/api/placeholder/300/200', caption: 'Chef at work', isMainPhoto: false },
    { type: 'photo', url: '/api/placeholder/300/200', caption: 'Outdoor patio', isMainPhoto: false },
    { type: 'photo', url: '/api/placeholder/300/200', caption: 'Signature dessert', isMainPhoto: false }
  ];

  // Monthly billing summary
  const billingSummary = [
    { month: 'December 2024', premiumFee: 100, addOns: 100, progressivePayouts: 4250, basicFees: 580, ccFees: 225, advertising: 599, total: 5854, invoiceUrl: '#' },
    { month: 'November 2024', premiumFee: 100, addOns: 100, progressivePayouts: 3890, basicFees: 545, ccFees: 198, advertising: 99, total: 4932, invoiceUrl: '#' },
    { month: 'October 2024', premiumFee: 100, addOns: 100, progressivePayouts: 4120, basicFees: 612, ccFees: 234, advertising: 2599, total: 7765, invoiceUrl: '#' },
    { month: 'September 2024', premiumFee: 100, addOns: 100, progressivePayouts: 3780, basicFees: 523, ccFees: 189, advertising: 0, total: 4692, invoiceUrl: '#' }
  ];

  // Bank account info (masked)
  const bankInfo = {
    type: 'Bank Account',
    bankName: 'Chase Bank',
    accountLast4: '3453',
    routingLast4: '5345'
  };

  const recentActivity = [
    { customer: 'Sarah M.', amount: 68.50, status: 'approved', time: '23 mins ago', tier: 'Level 4' },
    { customer: 'John D.', amount: 42.30, status: 'pending', time: '1 hour ago', tier: 'Level 2' },
    { customer: 'Lisa K.', amount: 91.75, status: 'approved', time: '2 hours ago', tier: 'Level 6' },
    { customer: 'Mike R.', amount: 124.00, status: 'approved', time: '3 hours ago', tier: 'Level 7' },
    { customer: 'Emily W.', amount: 36.90, status: 'approved', time: '4 hours ago', tier: 'Level 1' },
    { customer: 'David P.', amount: 55.20, status: 'pending', time: '5 hours ago', tier: 'Level 3' },
    { customer: 'Rachel G.', amount: 78.45, status: 'approved', time: '6 hours ago', tier: 'Level 5' },
    { customer: 'Tom H.', amount: 102.30, status: 'approved', time: '7 hours ago', tier: 'Level 6' }
  ];

  // Top performing items/services
  const topItems = [
    { name: 'Artisan Bread Basket', orders: 234, revenue: 2808 },
    { name: 'Signature Pastries', orders: 198, revenue: 2970 },
    { name: 'Coffee & Beverages', orders: 445, revenue: 2225 },
    { name: 'Lunch Specials', orders: 167, revenue: 2839 },
    { name: 'Custom Cakes', orders: 42, revenue: 3360 }
  ];

  // Event management state
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
const [editingEvent, setEditingEvent] = useState<BusinessEvent | null>(null);


  // Events data
  const upcomingEvents = [
    {
      title: 'Live Jazz Night',
      description: 'Enjoy smooth jazz with local artists while savoring our specialty cocktails and appetizers.',
      category: 'Music',
      date: 'January 10, 2026',
      time: '7:00 PM - 10:00 PM',
      price: 'Free',
      capacity: 80,
      responses: { yes: 45, maybe: 18, no: 12 },
      image: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=400&h=300&fit=crop'
    },
    {
      title: 'Bingo Night',
      description: 'Classic bingo with amazing prizes! Food and drinks available for purchase.',
      category: 'Games',
      date: 'January 15, 2026',
      time: '6:30 PM - 9:00 PM',
      price: '$5 per card',
      capacity: 60,
      responses: { yes: 32, maybe: 14, no: 8 },
      image: 'https://images.unsplash.com/photo-1566895291281-cedb1763e8ad?w=400&h=300&fit=crop',
      bookingUrl: 'https://example.com/bingo-tickets'
    },
    {
      title: 'Karaoke Wednesday',
      description: 'Show off your singing skills! Private rooms available for groups.',
      category: 'Music',
      date: 'January 8, 2026',
      time: '8:00 PM - 12:00 AM',
      price: 'Free',
      capacity: 50,
      responses: { yes: 28, maybe: 22, no: 5 },
      image: 'https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=400&h=300&fit=crop'
    }
  ];

  const pastEvents = [
    {
      title: 'New Year\'s Eve Bash',
      description: 'Ring in 2026 with live music, champagne toast, and party favors!',
      category: 'Special Event',
      date: 'December 31, 2025',
      time: '9:00 PM - 2:00 AM',
      price: '$50',
      capacity: 120,
      responses: { yes: 120, maybe: 15, no: 8 },
      image: 'https://images.unsplash.com/photo-1467810563316-b5476525c0f9?w=400&h=300&fit=crop'
    },
    {
      title: 'Holiday Cookie Decorating',
      description: 'Family-friendly cookie decorating workshop with all supplies included.',
      category: 'Workshop',
      date: 'December 20, 2025',
      time: '2:00 PM - 4:00 PM',
      price: '$15',
      capacity: 40,
      responses: { yes: 35, maybe: 12, no: 3 },
      image: 'https://images.unsplash.com/photo-1576618148400-f54bed99fcfd?w=400&h=300&fit=crop'
    },
    {
      title: 'Trivia Tuesday',
      description: 'Test your knowledge across various categories. Winning team gets prizes!',
      category: 'Games',
      date: 'December 17, 2025',
      time: '7:00 PM - 9:00 PM',
      price: 'Free',
      capacity: 60,
      responses: { yes: 52, maybe: 18, no: 6 },
      image: 'https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?w=400&h=300&fit=crop'
    }
  ];

// -----------------------------
// PLAN STATUS FETCH
// -----------------------------
async function fetchPlanStatus(businessId: string) {
  const { data, error } = await supabaseBrowser
    .from("v_business_plan_status")
    .select("effective_plan_now")
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) {
    console.error("fetchPlanStatus error:", error);
    return;
  }

  setEffectivePlanNow(data?.effective_plan_now ?? null);
}

// Trigger plan fetch
useEffect(() => {
  if (!businessId) return;
  fetchPlanStatus(businessId);
}, [businessId]);


// -----------------------------
// BILLING BUNDLE FETCH
// -----------------------------
async function fetchBillingBundle(invoiceId: string) {
  const { data, error } = await supabaseBrowser.rpc(
    "get_invoice_with_lines",
    { invoice_id: invoiceId }
  );

  if (error) {
    console.error("BILLING BUNDLE ERROR:", error);
    return;
  }

  setInvoice(data?.invoice ?? null);
  setInvoiceLines(data?.lines ?? []);
}

// TEMP: hardcoded invoice id (we’ll replace later)
useEffect(() => {
  fetchBillingBundle("29a51f82-feb4-4b05-b2bb-b8b9b98aa53a");
}, []);

// Log AFTER invoice data exists
useEffect(() => {
  if (!invoice) return;

  console.log("BILLING CHECK:", {
    total_cents: invoice.total_cents,
    line_count: invoiceLines.length,
  });
}, [invoice, invoiceLines]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0a0f1a 100%)',
      fontFamily: '"Poppins", sans-serif',
      color: '#ffffff'
    }}>
      {/* Import Poppins font */}
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
      
      {/* Header */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '1.5rem 3rem',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '800',
              fontSize: '1.5rem',
              letterSpacing: '-0.02em'
            }}>
              L
            </div>
            <div>
              <div style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                background: 'linear-gradient(135deg, #ffffff 0%, #14b8a6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                LetsGo Business
              </div>
              <div style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                {businessData.name}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '10px',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            }}>
              Sign Out
            </button>
            <button style={{
              background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
              border: 'none',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '10px',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 20px rgba(20, 184, 166, 0.4)'
            }}
            onClick={() => setShowLegalDisclaimerModal(true)}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 25px rgba(20, 184, 166, 0.6)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(20, 184, 166, 0.4)';
            }}>
              <Settings size={16} />
              Publish Changes
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ padding: '2rem 3rem', maxWidth: '1600px', margin: '0 auto' }}>
        
{/* Navigation Tabs */}
<div style={{
  display: 'flex',
  gap: '0.5rem',
  marginBottom: '2rem',
  background: 'rgba(255, 255, 255, 0.02)',
  padding: '0.5rem',
  borderRadius: '12px',
  border: '1px solid rgba(255, 255, 255, 0.05)'
}}>
{[
  { id: 'overview', label: 'Overview', icon: <BarChart3 size={16} /> },
  { id: 'analytics', label: 'Analytics', icon: <TrendingUp size={16} /> },
  { id: 'receipts', label: 'Receipt Redemption', icon: <CheckCircle size={16} /> },
  { id: 'media', label: 'Media Gallery', icon: <Camera size={16} /> },
  { id: 'events', label: 'Events', icon: <Calendar size={16} /> },
  { id: 'advertising', label: 'Advertising & Add-ons', icon: <TrendingUp size={16} /> },
  { id: 'billing', label: 'Plans & Billing', icon: <DollarSign size={16} /> },
  { id: 'profile', label: 'Profile Settings', icon: <Settings size={16} /> },
  { id: 'support', label: 'Support & Help', icon: <AlertCircle size={16} /> }
].map((tab) => {
  const premiumOnlyTabs = new Set(['events', 'advertising']);
  const isLocked = premiumOnlyTabs.has(tab.id) && !isPremium;

  return (
    <button
      key={tab.id}
      onClick={() => {
        if (isLocked) return;
        setActiveTab(tab.id);
      }}
      style={{
        flex: 1,
        padding: '0.875rem 1.5rem',
        background:
          activeTab === tab.id
            ? 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)'
            : 'transparent',
        border: 'none',
        color: 'white',
        borderRadius: '8px',
        fontSize: '0.875rem',
        fontWeight: '600',
        cursor: isLocked ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        transition: 'all 0.3s ease',
        boxShadow: activeTab === tab.id ? '0 4px 20px rgba(20, 184, 166, 0.4)' : 'none',

        // Premium gate look
        opacity: isLocked ? 0.45 : 1,
        filter: isLocked ? 'grayscale(1)' : 'none',
        pointerEvents: isLocked ? 'none' : 'auto',
        position: 'relative'
      }}
      title={isLocked ? 'Upgrade to Premium to unlock this feature.' : undefined}
    >
      {tab.icon}
      {tab.label}

      {isLocked && (
        <span
          style={{
            marginLeft: '0.5rem',
            padding: '0.15rem 0.45rem',
            borderRadius: '999px',
            fontSize: '0.65rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            background: 'rgba(249, 115, 22, 0.25)',
            border: '1px solid rgba(249, 115, 22, 0.5)',
            color: 'rgba(255, 255, 255, 0.9)'
          }}
        >
          PREMIUM
        </span>
      )}
    </button>
  );
})}

</div>

{!isPremium && (
  <div style={{
    marginTop: '1rem',
    padding: '0.75rem 1rem',
    background: 'rgba(249, 115, 22, 0.12)',
    border: '1px solid rgba(249, 115, 22, 0.35)',
    borderRadius: '10px',
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: '0.875rem',
    fontWeight: 600
  }}>
    Upgrade to <span style={{ color: '#f97316' }}>Premium</span> to unlock{" "}
    <span style={{ color: '#f97316' }}>Advertising</span> and{" "}
    <span style={{ color: '#f97316' }}>Events</span>.
  </div>
)}


        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div>
            {/* Welcome Header */}
            <div style={{
              background: `linear-gradient(135deg, ${colors.primary}20 0%, ${colors.accent}20 100%)`,
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '2rem',
              marginBottom: '2rem'
            }}>
              <div style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                Welcome to Your LetsGo Business Dashboard
              </div>
              <div style={{ fontSize: '0.9375rem', color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.6' }}>
                Your complete business management platform with receipt redemption, event management, analytics, advertising, and comprehensive support tools.
              </div>
            </div>

            {/* Key Metrics Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.5rem',
              marginBottom: '2rem'
            }}>
              {[
                {
                  icon: <Users size={24} />,
                  label: 'Total Customers',
                  value: analytics.customersSent.toLocaleString(),
                  change: `+${analytics.monthlyGrowth}% this month`,
                  color: colors.primary
                },
                {
                  icon: <DollarSign size={24} />,
                  label: 'Total Revenue',
                  value: `$${analytics.totalRevenue.toLocaleString()}`,
                  change: '+$12.4K this month',
                  color: colors.success
                },
                {
                  icon: <Calendar size={24} />,
                  label: 'Upcoming Events',
                  value: upcomingEvents.length,
                  change: `${upcomingEvents.reduce((sum, e) => sum + e.responses.yes, 0)} confirmed attendees`,
                  color: colors.accent
                },
                {
                  icon: <Clock size={24} />,
                  label: 'Pending Receipts',
                  value: pendingReceipts.length,
                  change: `$${analytics.pendingApproval.toLocaleString()} pending`,
                  color: colors.warning
                }
              ].map((stat, idx) => (
                <div key={idx} style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '-50%',
                    right: '-20%',
                    width: '150px',
                    height: '150px',
                    background: `radial-gradient(circle, ${stat.color}40 0%, transparent 70%)`,
                    borderRadius: '50%'
                  }} />
                  <div style={{
                    width: '48px',
                    height: '48px',
                    background: `${stat.color}20`,
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1rem',
                    color: stat.color
                  }}>
                    {stat.icon}
                  </div>
                  <div style={{
                    fontSize: '0.875rem',
                    color: 'rgba(255, 255, 255, 0.6)',
                    marginBottom: '0.5rem',
                    fontWeight: '500'
                  }}>
                    {stat.label}
                  </div>
                  <div style={{
                    fontSize: '2rem',
                    fontWeight: '700',
                    marginBottom: '0.5rem',
                    fontFamily: '"Space Mono", monospace'
                  }}>
                    {stat.value}
                  </div>
                  <div style={{
                    fontSize: '0.875rem',
                    color: '#10b981',
                    fontWeight: '600'
                  }}>
                    {stat.change}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Actions Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1.5rem',
              marginBottom: '2rem'
            }}>
              {[
                {
                  title: 'Receipt Redemption',
                  description: 'Review and approve customer receipts',
                  icon: <FileText size={20} />,
                  color: colors.primary,
                  action: 'receipts',
                  badge: `${pendingReceipts.length} pending`
                },
                {
                  title: 'Events',
                  description: 'Manage upcoming and past events',
                  icon: <Calendar size={20} />,
                  color: colors.accent,
                  action: 'events',
                  badge: `${upcomingEvents.length} upcoming`
                },
                {
                  title: 'Media Gallery',
                  description: 'Upload photos and videos',
                  icon: <Camera size={20} />,
                  color: colors.secondary,
                  action: 'media',
                  badge: 'Add content'
                },
                {
                  title: 'Advertising',
                  description: 'Boost visibility with campaigns',
                  icon: <TrendingUp size={20} />,
                  color: colors.warning,
                  action: 'advertising',
                  badge: '5 options'
                }
              ].map((action, idx) => (
                <div
                  key={idx}
                  onClick={() => {
  const premiumOnly = new Set(["events", "advertising"]);
  const locked = premiumOnly.has(action.action) && !isPremium;
  if (locked) return;
  setActiveTab(action.action);
}}

style={{
  background: 'rgba(255, 255, 255, 0.03)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: '12px',
  padding: '1.5rem',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  position: 'relative',

  // 🔒 Premium gate
  opacity: (!isPremium && (action.action === 'events' || action.action === 'advertising')) ? 0.45 : 1,
  filter: (!isPremium && (action.action === 'events' || action.action === 'advertising')) ? 'grayscale(1)' : 'none',
  pointerEvents: (!isPremium && (action.action === 'events' || action.action === 'advertising')) ? 'none' : 'auto',
}}

                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.borderColor = action.color + '60';
                    e.currentTarget.style.boxShadow = `0 8px 30px ${action.color}30`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1rem',
                    background: `${action.color}20`,
                    color: action.color,
                    padding: '0.25rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                    fontWeight: '600'
                  }}>
                    {action.badge}
                  </div>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    background: `${action.color}20`,
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1rem',
                    color: action.color
                  }}>
                    {action.icon}
                  </div>
                  <div style={{
                    fontSize: '1.125rem',
                    fontWeight: '700',
                    marginBottom: '0.5rem'
                  }}>
                    {action.title}
                  </div>
                  <div style={{
                    fontSize: '0.875rem',
                    color: 'rgba(255, 255, 255, 0.6)',
                    lineHeight: '1.5'
                  }}>
                    {action.description}
                  </div>
                </div>
              ))}
            </div>
{!isPremium && (
  <div
    style={{
      marginTop: '1rem',
      padding: '0.75rem 1rem',
      background: 'rgba(249, 115, 22, 0.12)',
      border: '1px solid rgba(249, 115, 22, 0.35)',
      borderRadius: '10px',
      color: 'rgba(255, 255, 255, 0.9)',
      fontSize: '0.875rem',
      fontWeight: 600,
    }}
  >
    Upgrade to <span style={{ color: '#f97316' }}>Premium</span> to unlock{" "}
    <span style={{ color: '#f97316' }}>Events</span> and{" "}
    <span style={{ color: '#f97316' }}>Advertising</span>.
  </div>
)}





            {/* Recent Activity */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '2rem',
              marginBottom: '2rem'
            }}>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <Clock size={20} style={{ color: colors.primary }} />
                Recent Activity
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {recentActivity.map((activity, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '600'
                      }}>
                        {activity.customer.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: '600', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {activity.customer}
                          <span style={{
                            fontSize: '0.75rem',
                            padding: '0.125rem 0.5rem',
                            background: 'rgba(20, 184, 166, 0.2)',
                            color: colors.primary,
                            borderRadius: '4px',
                            fontWeight: '500'
                          }}>
                            {activity.tier}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                          {activity.time}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{
                        fontFamily: '"Space Mono", monospace',
                        fontSize: '1.125rem',
                        fontWeight: '700'
                      }}>
                        ${activity.amount.toFixed(2)}
                      </div>
                      {activity.status === 'approved' ? (
                        <CheckCircle size={20} style={{ color: colors.success }} />
                      ) : (
                        <AlertCircle size={20} style={{ color: colors.warning }} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Platform Features Summary */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '2rem'
            }}>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                marginBottom: '1.5rem'
              }}>
                Your Complete Business Management Suite
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                {[
                  { icon: <BarChart3 size={18} />, title: 'Analytics', description: 'Revenue tracking & insights' },
                  { icon: <Award size={18} />, title: 'Progressive Payout', description: 'Reward loyal customers' },
                  { icon: <Calendar size={18} />, title: 'Event Management', description: 'Create & track events' },
                  { icon: <TrendingUp size={18} />, title: 'Advertising', description: 'Boost your visibility' },
                  { icon: <CreditCard size={18} />, title: 'Billing & Plans', description: 'Manage subscriptions' },
                  { icon: <HelpCircle size={18} />, title: 'Support & Help', description: '24/7 assistance' }
                ].map((feature, idx) => (
                  <div key={idx} style={{
                    padding: '1rem',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.05)'
                  }}>
                    <div style={{
                      color: colors.primary,
                      marginBottom: '0.75rem'
                    }}>
                      {feature.icon}
                    </div>
                    <div style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                      {feature.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                      {feature.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            
            {/* Additional Stats Row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem'
            }}>
              {[
                { label: 'Approval Rate', value: `${analytics.approvalRate}%`, icon: <CheckCircle size={18} />, color: colors.success },
                { label: 'Repeat Customer Rate', value: `${analytics.repeatCustomerRate}%`, icon: <Users size={18} />, color: colors.primary },
                { label: 'Pending Receipt Approval', value: analytics.receiptsPending, icon: <Clock size={18} />, color: colors.warning },
                { label: 'Effective Fee Rate', value: `${effectiveFeePercentage}%`, icon: <DollarSign size={18} />, color: colors.secondary },
                { label: 'New Customers', value: analytics.newCustomers, icon: <TrendingUp size={18} />, color: colors.accent }
              ].map((item, idx) => (
                <div key={idx} style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '1.25rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: item.color }}>
                    {item.icon}
                    <span style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)' }}>{item.label}</span>
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: '700', fontFamily: '"Space Mono", monospace' }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Revenue Trend Chart with Toggle */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '2rem'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem'
              }}>
                <div style={{
                  fontSize: '1.25rem',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <TrendingUp size={20} style={{ color: colors.primary }} />
                  Revenue & Customer Trends
                </div>
                
                {/* View Toggle */}
                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: '0.25rem',
                  borderRadius: '8px'
                }}>
                  {[
                    { id: '30days', label: '30 Days' },
                    { id: 'monthly', label: 'Monthly' },
                    { id: 'yearly', label: 'Yearly' }
                  ].map(view => (
                    <button
                      key={view.id}
                      onClick={() => setRevenueView(view.id)}
                      style={{
                        padding: '0.5rem 1rem',
                        background: revenueView === view.id ? colors.primary : 'transparent',
                        border: 'none',
                        borderRadius: '6px',
                        color: 'white',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      {view.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={
                  revenueView === '30days' ? revenueData : 
                  revenueView === 'monthly' ? monthlyRevenueData : 
                  yearlyRevenueData
                }>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colors.primary} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={colors.primary} stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCustomers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colors.secondary} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={colors.secondary} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis 
                    dataKey={revenueView === '30days' ? 'date' : revenueView === 'monthly' ? 'month' : 'year'} 
                    stroke="rgba(255,255,255,0.5)" 
                  />
                  <YAxis stroke="rgba(255,255,255,0.5)" />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'rgba(15, 23, 42, 0.95)', 
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: 'white'
                    }} 
                  />
                  <Legend />
                  <Area type="monotone" dataKey="revenue" stroke={colors.primary} fillOpacity={1} fill="url(#colorRevenue)" name="Revenue ($)" />
                  <Area type="monotone" dataKey="customers" stroke={colors.secondary} fillOpacity={1} fill="url(#colorCustomers)" name="Customers" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Weekly Performance */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '2rem'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem'
              }}>
                <div style={{
                  fontSize: '1.25rem',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <BarChart3 size={20} style={{ color: colors.secondary }} />
                  Weekly Performance by Day
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button style={{
                    padding: '0.5rem 1rem',
                    background: `${colors.success}20`,
                    border: `1px solid ${colors.success}`,
                    borderRadius: '6px',
                    color: colors.success,
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <Download size={14} />
                    CSV
                  </button>
                  <button style={{
                    padding: '0.5rem 1rem',
                    background: `${colors.accent}20`,
                    border: `1px solid ${colors.accent}`,
                    borderRadius: '6px',
                    color: colors.accent,
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <Download size={14} />
                    XLSX
                  </button>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="day" stroke="rgba(255,255,255,0.5)" />
                  <YAxis stroke="rgba(255,255,255,0.5)" />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'rgba(15, 23, 42, 0.95)', 
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: 'white'
                    }} 
                  />
                  <Legend />
                  <Bar dataKey="visits" fill={colors.primary} name="Customer Visits" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="revenue" fill={colors.secondary} name="Revenue ($)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Customer Tier Distribution - Side by Side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              
              {/* By Customer Count */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '2rem'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.5rem'
                }}>
                  <div style={{
                    fontSize: '1.25rem',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <Award size={20} style={{ color: colors.primary }} />
                    Repeat Customers by Level
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button style={{
                      padding: '0.375rem 0.75rem',
                      background: `${colors.success}20`,
                      border: `1px solid ${colors.success}`,
                      borderRadius: '6px',
                      color: colors.success,
                      fontSize: '0.65rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}>
                      <Download size={12} />
                      CSV
                    </button>
                    <button style={{
                      padding: '0.375rem 0.75rem',
                      background: `${colors.accent}20`,
                      border: `1px solid ${colors.accent}`,
                      borderRadius: '6px',
                      color: colors.accent,
                      fontSize: '0.65rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}>
                      <Download size={12} />
                      XLSX
                    </button>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={customerTierData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis type="number" stroke="rgba(255,255,255,0.5)" />
                    <YAxis dataKey="tier" type="category" stroke="rgba(255,255,255,0.5)" />
                    <Tooltip 
                      contentStyle={{ 
                        background: 'rgba(15, 23, 42, 0.95)', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        color: 'white'
                      }} 
                    />
                    <Bar dataKey="customers" radius={[0, 8, 8, 0]} name="Customers">
                      {customerTierData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* By Revenue */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '2rem'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.5rem'
                }}>
                  <div style={{
                    fontSize: '1.25rem',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <DollarSign size={20} style={{ color: colors.success }} />
                    Revenue by Customer Level
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button style={{
                      padding: '0.375rem 0.75rem',
                      background: `${colors.success}20`,
                      border: `1px solid ${colors.success}`,
                      borderRadius: '6px',
                      color: colors.success,
                      fontSize: '0.65rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}>
                      <Download size={12} />
                      CSV
                    </button>
                    <button style={{
                      padding: '0.375rem 0.75rem',
                      background: `${colors.accent}20`,
                      border: `1px solid ${colors.accent}`,
                      borderRadius: '6px',
                      color: colors.accent,
                      fontSize: '0.65rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}>
                      <Download size={12} />
                      XLSX
                    </button>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={customerTierData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis type="number" stroke="rgba(255,255,255,0.5)" />
                    <YAxis dataKey="tier" type="category" stroke="rgba(255,255,255,0.5)" />
                    <Tooltip 
                      contentStyle={{ 
                        background: 'rgba(15, 23, 42, 0.95)', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        color: 'white'
                      }} 
                    />
                    <Bar dataKey="revenue" radius={[0, 8, 8, 0]} name="Revenue ($)">
                      {customerTierData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Receipt History Table */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '2rem'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem'
              }}>
                <div style={{
                  fontSize: '1.25rem',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <CheckCircle size={20} style={{ color: colors.primary }} />
                  Recent Receipt History
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button style={{
                    padding: '0.5rem 1rem',
                    background: `${colors.success}20`,
                    border: `1px solid ${colors.success}`,
                    borderRadius: '6px',
                    color: colors.success,
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <Download size={14} />
                    CSV
                  </button>
                  <button style={{
                    padding: '0.5rem 1rem',
                    background: `${colors.accent}20`,
                    border: `1px solid ${colors.accent}`,
                    borderRadius: '6px',
                    color: colors.accent,
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <Download size={14} />
                    XLSX
                  </button>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600' }}>Receipt ID</th>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600' }}>Customer</th>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600' }}>Date</th>
                      <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600' }}>Subtotal</th>
                      <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600' }}>Progressive Fee</th>
                      <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600' }}>Basic Fee</th>
                      <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600' }}>CC Fee (3.5%)</th>
                      <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600' }}>Total Fees</th>
                      <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600' }}>Status</th>
                      <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600' }}>Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receiptHistory.map((receipt, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ padding: '1rem', fontSize: '0.875rem', fontFamily: '"Space Mono", monospace' }}>{receipt.id}</td>
                        <td style={{ padding: '1rem', fontSize: '0.875rem' }}>{receipt.customer}</td>
                        <td style={{ padding: '1rem', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)' }}>{receipt.date}</td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: '"Space Mono", monospace' }}>${receipt.subtotal.toFixed(2)}</td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: '"Space Mono", monospace', color: colors.primary }}>${receipt.progressivePayout.toFixed(2)}</td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: '"Space Mono", monospace', color: colors.secondary }}>${receipt.basicFee.toFixed(2)}</td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: '"Space Mono", monospace', color: colors.warning }}>${receipt.creditCardFee.toFixed(2)}</td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: '"Space Mono", monospace', fontWeight: '700' }}>${receipt.totalFees.toFixed(2)}</td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          {receipt.status === 'approved' ? (
                            <span style={{ 
                              padding: '0.25rem 0.75rem', 
                              background: `${colors.success}20`, 
                              color: colors.success, 
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              textTransform: 'capitalize'
                            }}>
                              {receipt.status}
                            </span>
                          ) : (
                            <span style={{ 
                              padding: '0.25rem 0.75rem', 
                              background: `${colors.warning}20`, 
                              color: colors.warning, 
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              textTransform: 'capitalize'
                            }}>
                              {receipt.status}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          <a href={receipt.receiptUrl} style={{ 
                            color: colors.accent, 
                            textDecoration: 'none',
                            fontSize: '0.875rem',
                            fontWeight: '600'
                          }}>
                            View
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* Media Gallery Tab */}
        {activeTab === 'media' && (
          <div>
            {/* Video Stats Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1rem',
              marginBottom: '2rem'
            }}>
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '1.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: colors.primary }}>
                  <Video size={18} />
                  <span style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)' }}>Active Videos</span>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: '700', fontFamily: '"Space Mono", monospace', marginBottom: '0.5rem' }}>
                  {videoLimits.activeVideos} / {videoLimits.maxActiveVideos}
                </div>
                <div style={{ 
                  width: '100%', 
                  height: '8px', 
                  background: 'rgba(255, 255, 255, 0.1)', 
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${(videoLimits.activeVideos / videoLimits.maxActiveVideos) * 100}%`,
                    height: '100%',
                    background: colors.primary,
                    borderRadius: '4px'
                  }} />
                </div>
              </div>

              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '1.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: colors.accent }}>
                  <Camera size={18} />
                  <span style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)' }}>Library Videos</span>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: '700', fontFamily: '"Space Mono", monospace', marginBottom: '0.5rem' }}>
                  {videoLimits.libraryVideos} / {videoLimits.maxLibraryVideos}
                </div>
                <div style={{ 
                  width: '100%', 
                  height: '8px', 
                  background: 'rgba(255, 255, 255, 0.1)', 
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${(videoLimits.libraryVideos / videoLimits.maxLibraryVideos) * 100}%`,
                    height: '100%',
                    background: colors.accent,
                    borderRadius: '4px'
                  }} />
                </div>
              </div>

              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '1.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: colors.warning }}>
                  <Clock size={18} />
                  <span style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)' }}>Pending Approval</span>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: '700', fontFamily: '"Space Mono", monospace', marginBottom: '0.5rem' }}>
                  {videoLimits.pendingApproval}
                </div>
                <button style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: `${colors.warning}20`,
                  border: `1px solid ${colors.warning}`,
                  borderRadius: '6px',
                  color: colors.warning,
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = colors.warning;
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = `${colors.warning}20`;
                  e.currentTarget.style.color = colors.warning;
                }}>
                  Review Now
                </button>
              </div>
            </div>


{/* Pending Video Approvals */}
{videoLimits.pendingApproval > 0 && (
  <div
    style={{
      background: "rgba(255, 255, 255, 0.03)",
      backdropFilter: "blur(20px)",
      border: "1px solid rgba(255, 255, 255, 0.08)",
      borderRadius: "16px",
      padding: "2rem",
      marginBottom: "2rem",

      // 🔒 Premium gate
      opacity: videosLocked ? 0.45 : 1,
      filter: videosLocked ? "grayscale(1)" : "none",
      pointerEvents: videosLocked ? "none" : "auto",
    }}
  >
    {/* Section Header */}
    <div
      style={{
        fontSize: "1.25rem",
        fontWeight: "700",
        marginBottom: "1.5rem",
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
      }}
    >
      <AlertCircle size={20} style={{ color: colors.warning }} />
      Videos Pending Your Approval
    </div>

    {/* Premium lock callout */}
    {videosLocked && (
      <div
        style={{
          marginTop: "-0.5rem",
          marginBottom: "1.25rem",
          padding: "0.75rem 1rem",
          background: "rgba(249, 115, 22, 0.12)",
          border: "1px solid rgba(249, 115, 22, 0.35)",
          borderRadius: "10px",
          fontSize: "0.875rem",
          fontWeight: 600,
          color: "rgba(255, 255, 255, 0.85)",
          lineHeight: 1.4,
        }}
      >
        <strong>Premium feature:</strong> Upgrade to Premium to review and approve user videos.
      </div>
    )}

    <div style={{ display: "grid", gap: "1rem" }}>
      {pendingVideos.map((video, idx) => (
        <div
          key={idx}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            padding: "1rem",
            background: "rgba(255, 255, 255, 0.02)",
            borderRadius: "12px",
            border: "1px solid rgba(255, 255, 255, 0.05)",
          }}
        >
          <img
            src={video.thumbnail}
            alt={video.title}
            style={{
              width: "120px",
              height: "80px",
              borderRadius: "8px",
              objectFit: "cover",
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{video.title}</div>
            <div style={{ fontSize: "0.875rem", color: "rgba(255, 255, 255, 0.6)" }}>
              Uploaded by {video.user} • {video.uploadDate}
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              style={{
                padding: "0.5rem 1rem",
                background: `${colors.success}20`,
                border: `1px solid ${colors.success}`,
                borderRadius: "6px",
                color: colors.success,
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = colors.success;
                el.style.color = "white";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = `${colors.success}20`;
                el.style.color = colors.success;
              }}
            >
              Approve
            </button>

            <button
              type="button"
              style={{
                padding: "0.5rem 1rem",
                background: `${colors.danger}20`,
                border: `1px solid ${colors.danger}`,
                borderRadius: "6px",
                color: colors.danger,
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = colors.danger;
                el.style.color = "white";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = `${colors.danger}20`;
                el.style.color = colors.danger;
              }}
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
)}


    {/* Pending Videos List */}
    <div style={{ display: 'grid', gap: '1rem' }}>
      {pendingVideos.map((video, idx) => (
        <div
          key={idx}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            padding: '1rem',
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}
        >
          <img
            src={video.thumbnail}
            alt={video.title}
            style={{
              width: '120px',
              height: '80px',
              borderRadius: '8px',
              objectFit: 'cover'
            }}
          />

          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
              {video.title}
            </div>
            <div
              style={{
                fontSize: '0.875rem',
                color: 'rgba(255, 255, 255, 0.6)'
              }}
            >
              Uploaded by {video.user} • {video.uploadDate}
            </div>
          </div>

          {/* Action Buttons (disabled by pointerEvents when locked) */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              style={{
                padding: '0.5rem 0.75rem',
                background: `${colors.success}20`,
                border: `1px solid ${colors.success}`,
                borderRadius: '6px',
                color: colors.success,
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Approve
            </button>

            <button
              style={{
                padding: '0.5rem 0.75rem',
                background: `${colors.danger}20`,
                border: `1px solid ${colors.danger}`,
                borderRadius: '6px',
                color: colors.danger,
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
)}


            {/* Upload Section */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '2rem',
              marginBottom: '2rem'
            }}>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <Upload size={20} style={{ color: colors.primary }} />
                Upload Media
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                  onClick={() => setShowPhotoUploadModal(true)}
                  style={{
                  flex: 1,
                  padding: '2rem',
                  background: `rgba(20, 184, 166, 0.1)`,
                  border: `2px dashed rgba(20, 184, 166, 0.3)`,
                  borderRadius: '12px',
                  color: colors.primary,
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.75rem',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = `rgba(20, 184, 166, 0.15)`;
                  e.currentTarget.style.borderColor = `rgba(20, 184, 166, 0.5)`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = `rgba(20, 184, 166, 0.1)`;
                  e.currentTarget.style.borderColor = `rgba(20, 184, 166, 0.3)`;
                }}>
                  <Camera size={32} />
                  Upload Photos
                </button>
                <button 
                  onClick={() => setShowVideoUploadModal(true)}
                  style={{
                  flex: 1,
                  padding: '2rem',
                  background: `rgba(249, 115, 22, 0.1)`,
                  border: `2px dashed rgba(249, 115, 22, 0.3)`,
                  borderRadius: '12px',
                  color: colors.secondary,
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.75rem',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = `rgba(249, 115, 22, 0.15)`;
                  e.currentTarget.style.borderColor = `rgba(249, 115, 22, 0.5)`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = `rgba(249, 115, 22, 0.1)`;
                  e.currentTarget.style.borderColor = `rgba(249, 115, 22, 0.3)`;
                }}>
                  <Video size={32} />
                  Upload Videos
                </button>
              </div>
            </div>

            {/* Gallery Grid */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '2rem'
            }}>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <Eye size={20} style={{ color: colors.primary }} />
                Current Media
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: '1.5rem'
              }}>
                {mediaGallery.map((item, idx) => (
                  <div key={idx} style={{
                    position: 'relative',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    aspectRatio: '3/2',
                    background: 'rgba(255, 255, 255, 0.05)',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    border: item.isMainPhoto ? `2px solid ${colors.primary}` : '2px solid transparent'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                    <img src={item.url} alt={item.caption} style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }} />
                    
                    {/* Main Photo Badge */}
                    {item.isMainPhoto && (
                      <div style={{
                        position: 'absolute',
                        top: '0.75rem',
                        left: '0.75rem',
                        background: colors.primary,
                        color: 'white',
                        padding: '0.375rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}>
                        <Award size={12} />
                        Main Photo
                      </div>
                    )}
                    
                    <div style={{
                      position: 'absolute',
                      top: '0.75rem',
                      right: '0.75rem',
                      background: 'rgba(0, 0, 0, 0.7)',
                      backdropFilter: 'blur(10px)',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      {item.type === 'video' ? <Video size={14} /> : <Camera size={14} />}
                      {item.type}
                    </div>
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'linear-gradient(transparent, rgba(0, 0, 0, 0.9))',
                      padding: '3rem 1rem 1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: '500' }}>
                        {item.caption}
                      </div>
                      {item.type === 'photo' && !item.isMainPhoto && (
                        <button style={{
                          padding: '0.5rem',
                          background: `${colors.primary}20`,
                          border: `1px solid ${colors.primary}`,
                          borderRadius: '6px',
                          color: colors.primary,
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = colors.primary;
                          e.currentTarget.style.color = 'white';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = `${colors.primary}20`;
                          e.currentTarget.style.color = colors.primary;
                        }}
                        onClick={e => {
                          e.stopPropagation();
                          // Set as main photo logic would go here
                        }}>
                          Set as Main Photo
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )

        {/* Events Tab */}
        {activeTab === 'events' && (
          <div>
            {/* Header */}
            <div style={{
              marginBottom: '2rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                  Event Management
                </div>
                <div style={{ fontSize: '0.9375rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                  Create and manage events to engage your customers
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingEvent(null);
                  setShowCreateEventModal(true);
                }}
                style={{
                  padding: '0.875rem 1.75rem',
                  background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.accent} 100%)`,
                  border: 'none',
                  borderRadius: '12px',
                  color: 'white',
                  fontSize: '0.9375rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: `0 4px 20px ${colors.primary}40`
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = `0 6px 25px ${colors.primary}60`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = `0 4px 20px ${colors.primary}40`;
                }}
              >
                Create New Event
              </button>
            </div>

            {/* Stats Dashboard */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1.5rem',
              marginBottom: '2rem'
            }}>
              {[
                { 
                  label: 'Upcoming Events', 
                  value: upcomingEvents.length,
                  icon: <Calendar size={24} />,
                  color: colors.primary
                },
                { 
                  label: 'Total "Yes" Responses', 
                  value: upcomingEvents.reduce((sum, e) => sum + e.responses.yes, 0),
                  icon: <CheckCircle size={24} />,
                  color: colors.success
                },
                { 
                  label: 'This Month', 
                  value: upcomingEvents.filter(e => e.date.includes('January')).length,
                  icon: <Calendar size={24} />,
                  color: colors.warning
                },
                { 
                  label: 'Past Events', 
                  value: pastEvents.length,
                  icon: <Clock size={24} />,
                  color: colors.accent
                }
              ].map((stat, idx) => (
                <div key={idx} style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '1.5rem'
                }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    background: `${stat.color}20`,
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1rem',
                    color: stat.color
                  }}>
                    {stat.icon}
                  </div>
                  <div style={{
                    fontSize: '0.875rem',
                    color: 'rgba(255, 255, 255, 0.6)',
                    marginBottom: '0.5rem'
                  }}>
                    {stat.label}
                  </div>
                  <div style={{
                    fontSize: '2rem',
                    fontWeight: '700',
                    fontFamily: '"Space Mono", monospace'
                  }}>
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Upcoming Events */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '2rem',
              marginBottom: '2rem'
            }}>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                marginBottom: '1.5rem'
              }}>
                Upcoming Events
              </div>
              
              {upcomingEvents.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {upcomingEvents.map((event, idx) => (
                    <div key={idx} style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.borderColor = colors.primary + '40';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    }}>
                      {/* Left 33%: Event Image */}
                      <div style={{
                        position: 'relative',
                        overflow: 'hidden',
                        padding: '1.5rem'
                      }}>
                        <div style={{
                          width: '100%',
                          height: '100%',
                          minHeight: '200px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          position: 'relative'
                        }}>
                          <img 
                            src={event.image} 
                            alt={event.title}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover'
                            }}
                          />
                          <div style={{
                            position: 'absolute',
                            top: '0.75rem',
                            left: '0.75rem',
                            background: event.category === 'Music' ? colors.primary : event.category === 'Games' ? colors.secondary : colors.accent,
                            color: 'white',
                            padding: '0.375rem 0.875rem',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: '700'
                          }}>
                            {event.category}
                          </div>
                        </div>
                      </div>

                      {/* Middle 33%: Title, Date, Time, Price */}
                      <div style={{ 
                        padding: '1.5rem',
                        display: 'flex', 
                        flexDirection: 'column', 
                        justifyContent: 'center',
                        borderLeft: '1px solid rgba(255, 255, 255, 0.05)',
                        borderRight: '1px solid rgba(255, 255, 255, 0.05)'
                      }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1.25rem', lineHeight: '1.3' }}>
                          {event.title}
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <div>
                            <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.75rem', marginBottom: '0.375rem', fontWeight: '600', letterSpacing: '0.05em' }}>
                              DATE
                            </div>
                            <div style={{ fontWeight: '600', fontSize: '0.9375rem' }}>{event.date}</div>
                          </div>
                          
                          <div>
                            <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.75rem', marginBottom: '0.375rem', fontWeight: '600', letterSpacing: '0.05em' }}>
                              TIME
                            </div>
                            <div style={{ fontWeight: '600', fontSize: '0.9375rem' }}>{event.time}</div>
                          </div>
                          
                          <div>
                            <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.75rem', marginBottom: '0.375rem', fontWeight: '600', letterSpacing: '0.05em' }}>
                              PRICE
                            </div>
                            <div style={{ fontWeight: '700', color: colors.warning, fontSize: '1.125rem' }}>{event.price}</div>
                          </div>
                        </div>
                      </div>

                      {/* Right 33%: Responses & Action Buttons - CENTERED */}
                      <div style={{ 
                        padding: '1.5rem', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        {/* Centered Content Container - 160px width */}
                        <div style={{ width: '160px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {/* External Booking Badge */}
                          {event.bookingUrl && (
                            <div style={{
                              background: `${colors.accent}20`,
                              border: `1px solid ${colors.accent}`,
                              padding: '0.25rem 0.5rem',
                              borderRadius: '6px',
                              fontSize: '0.6rem',
                              fontWeight: '600',
                              color: colors.accent,
                              textAlign: 'center',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.25rem'
                            }}>
                              <ChevronRight size={10} />
                              External Booking
                            </div>
                          )}
                          
                          {/* Response Counters */}
                          <div style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            padding: '0.75rem',
                            borderRadius: '8px'
                          }}>
                            <div style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.625rem', textAlign: 'center', fontWeight: '600', letterSpacing: '0.05em' }}>
                              ATTENDING?
                            </div>
                            
                            {/* Yes Counter */}
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '0.375rem',
                              padding: '0.375rem 0.5rem',
                              background: `${colors.success}15`,
                              borderRadius: '4px'
                            }}>
                              <div style={{ fontSize: '0.75rem', color: colors.success, fontWeight: '600' }}>
                                Yes
                              </div>
                              <div style={{ fontSize: '0.875rem', fontWeight: '700', color: colors.success, fontFamily: '"Space Mono", monospace' }}>
                                {event.responses.yes}
                              </div>
                            </div>
                            
                            {/* Maybe Counter */}
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '0.375rem',
                              padding: '0.375rem 0.5rem',
                              background: `${colors.warning}15`,
                              borderRadius: '4px'
                            }}>
                              <div style={{ fontSize: '0.75rem', color: colors.warning, fontWeight: '600' }}>
                                Maybe
                              </div>
                              <div style={{ fontSize: '0.875rem', fontWeight: '700', color: colors.warning, fontFamily: '"Space Mono", monospace' }}>
                                {event.responses.maybe}
                              </div>
                            </div>
                            
                            {/* No Counter */}
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '0.375rem 0.5rem',
                              background: 'rgba(255, 255, 255, 0.05)',
                              borderRadius: '4px'
                            }}>
                              <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600' }}>
                                No
                              </div>
                              <div style={{ fontSize: '0.875rem', fontWeight: '700', color: 'rgba(255, 255, 255, 0.6)', fontFamily: '"Space Mono", monospace' }}>
                                {event.responses.no}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons - 160px width */}
                        <div style={{ width: '160px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <button
                            onClick={() => {
                              setEditingEvent(event);
                              setShowCreateEventModal(true);
                            }}
                            style={{
                              padding: '0.5rem 0.75rem',
                              background: `${colors.primary}20`,
                              border: `1px solid ${colors.primary}`,
                              borderRadius: '6px',
                              color: colors.primary,
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.3s ease'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = colors.primary;
                              e.currentTarget.style.color = 'white';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = `${colors.primary}20`;
                              e.currentTarget.style.color = colors.primary;
                            }}
                          >
                            Edit
                          </button>
                          <button
                            style={{
                              padding: '0.5rem 0.75rem',
                              background: `${colors.accent}20`,
                              border: `1px solid ${colors.accent}`,
                              borderRadius: '6px',
                              color: colors.accent,
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.3s ease'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = colors.accent;
                              e.currentTarget.style.color = 'white';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = `${colors.accent}20`;
                              e.currentTarget.style.color = colors.accent;
                            }}
                          >
                            Duplicate
                          </button>
                          <button
                            style={{
                              padding: '0.5rem 0.75rem',
                              background: `${colors.danger}20`,
                              border: `1px solid ${colors.danger}`,
                              borderRadius: '6px',
                              color: colors.danger,
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.3s ease'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = colors.danger;
                              e.currentTarget.style.color = 'white';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = `${colors.danger}20`;
                              e.currentTarget.style.color = colors.danger;
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  padding: '3rem',
                  textAlign: 'center',
                  color: 'rgba(255, 255, 255, 0.5)'
                }}>
                  <Calendar size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                  <div style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>No upcoming events</div>
                  <div style={{ fontSize: '0.875rem' }}>Create your first event to engage customers!</div>
                </div>
              )}
            </div>

            {/* Past Events */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '2rem'
            }}>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                marginBottom: '1.5rem'
              }}>
                Past Events
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {pastEvents.map((event, idx) => (
                  <div key={idx} style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    padding: '1rem',
                    opacity: 0.7,
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                      <img 
                        src={event.image} 
                        alt={event.title}
                        style={{
                          width: '100px',
                          height: '75px',
                          objectFit: 'cover',
                          borderRadius: '8px'
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '700', marginBottom: '0.5rem' }}>{event.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.25rem' }}>
                          {event.date} • {event.time}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: colors.success, fontWeight: '600' }}>
                          {event.responses.yes} yes, {event.responses.maybe} maybe
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '6px',
                          color: 'white',
                          fontSize: '0.75rem',
                          cursor: 'pointer'
                        }}
                      >
                        View Details
                      </button>
                      <button
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          background: `${colors.accent}20`,
                          border: `1px solid ${colors.accent}`,
                          borderRadius: '6px',
                          color: colors.accent,
                          fontSize: '0.75rem',
                          cursor: 'pointer'
                        }}
                      >
                        Duplicate
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Advertising Tab */}
        {activeTab === 'advertising' && (
          <div>
            {/* Current Add-ons & Monthly Costs */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '2rem',
              marginBottom: '2rem'
            }}>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1.5rem', color: colors.primary }}>
                Current Add-ons & Monthly Costs
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '3rem' }}>
                {/* Active Add-ons */}
                <div>
                  <div style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.75rem' }}>
                    Active Premium Add-ons
                  </div>
                  {subscription.addOns.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {subscription.addOns.map((addon, idx) => (
                        <div key={idx} style={{
                          padding: '0.75rem',
                          background: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: '8px',
                          fontSize: '0.875rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <CheckCircle size={16} style={{ color: colors.success }} />
                            <span>{addon.split('(')[0]}</span>
                          </div>
                          <button style={{
                            padding: '0.25rem 0.75rem',
                            background: `${colors.danger}20`,
                            border: `1px solid ${colors.danger}`,
                            borderRadius: '6px',
                            color: colors.danger,
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}>
                            Cancel
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                      No active add-ons
                    </div>
                  )}
                </div>

                {/* Itemized Monthly Costs */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  border: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  <div style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', color: colors.secondary }}>
                    This Month's Advertising & Add-ons
                  </div>
                  
                  {/* Itemized List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                    {/* Add-ons */}
                    {subscription.addOns.map((addon, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                        <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>{addon.split('(')[0]}</span>
                        <span style={{ fontFamily: '"Space Mono", monospace', fontWeight: '600' }}>$50.00</span>
                      </div>
                    ))}
                    
                    {/* TPMS */}
                    {tpmsEnabled && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                        <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>TPMS Service</span>
                        <span style={{ fontFamily: '"Space Mono", monospace', fontWeight: '600' }}>$200.00</span>
                      </div>
                    )}
                    
                    {/* Upcoming Advertising */}
                    {activeAdCampaigns.map((campaign, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                        <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>{campaign.campaign}</span>
                        <span style={{ fontFamily: '"Space Mono", monospace', fontWeight: '600' }}>${campaign.cost.toFixed(2)}</span>
                      </div>
                    ))}
                    
                    {/* If no items */}
                    {subscription.addOns.length === 0 && !tpmsEnabled && activeAdCampaigns.length === 0 && (
                      <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.875rem' }}>No charges this month</div>
                    )}
                  </div>
                  
                  {/* Divider */}
                  <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.1)', marginBottom: '1rem' }} />
                  
                  {/* Subtotals */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                      <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Add-ons Subtotal:</span>
                      <span style={{ fontFamily: '"Space Mono", monospace', color: colors.primary }}>
                        ${(subscription.addOns.length * 50 + (tpmsEnabled ? 200 : 0)).toFixed(2)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                      <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Advertising Subtotal:</span>
                      <span style={{ fontFamily: '"Space Mono", monospace', color: colors.accent }}>
                        ${activeAdCampaigns.reduce((sum, c) => sum + c.cost, 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Total */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem',
                    background: `linear-gradient(135deg, ${colors.secondary}20 0%, ${colors.primary}20 100%)`,
                    borderRadius: '8px',
                    border: `1px solid ${colors.secondary}40`
                  }}>
                    <span style={{ fontWeight: '700', fontSize: '1rem' }}>Total This Month:</span>
                    <span style={{ 
                      fontFamily: '"Space Mono", monospace', 
                      fontSize: '1.5rem', 
                      fontWeight: '800',
                      color: colors.secondary
                    }}>
                      ${(subscription.addOns.length * 50 + (tpmsEnabled ? 200 : 0) + activeAdCampaigns.reduce((sum, c) => sum + c.cost, 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Advertising & Add-on Spend Chart */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '2rem',
              marginBottom: '2rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <TrendingUp size={20} style={{ color: colors.secondary }} />
                  Advertising & Add-on Spend
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255, 255, 255, 0.05)', padding: '0.25rem', borderRadius: '8px' }}>
                  {[
                    { id: 'monthly', label: 'Monthly' },
                    { id: 'yearly', label: 'Yearly' }
                  ].map(view => (
                    <button
                      key={view.id}
                      onClick={() => setSpendView(view.id)}
                      style={{
                        padding: '0.5rem 1rem',
                        background: spendView === view.id ? colors.secondary : 'transparent',
                        border: 'none',
                        borderRadius: '6px',
                        color: 'white',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      {view.label}
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={spendView === 'monthly' ? monthlySpendData : yearlySpendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey={spendView === 'monthly' ? 'month' : 'year'} stroke="rgba(255,255,255,0.5)" />
                  <YAxis stroke="rgba(255,255,255,0.5)" />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'rgba(15, 23, 42, 0.95)', 
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: 'white'
                    }}
                    formatter={(value) => [`$${value}`, '']}
                  />
                  <Legend />
                  <Bar dataKey="advertising" fill={colors.secondary} name="Advertising ($)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="addOns" fill={colors.primary} name="Add-ons ($)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Upcoming & Active Campaigns */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '2rem',
              marginBottom: '2rem'
            }}>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={20} style={{ color: colors.warning }} />
                Upcoming & Active Campaigns
              </div>
              {activeAdCampaigns.length > 0 ? (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {activeAdCampaigns.map((campaign, idx) => (
                    <div key={idx} style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      padding: '1.5rem',
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: '1.5rem',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                          {campaign.campaign}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.5rem' }}>
                          {campaign.startDate} - {campaign.endDate}
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem' }}>
                          <div>
                            <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)' }}>Cost: </span>
                            <span style={{ fontSize: '0.875rem', fontWeight: '700', fontFamily: '"Space Mono", monospace' }}>
                              ${campaign.cost.toLocaleString()}
                            </span>
                          </div>
                          <div>
                            <span style={{
                              padding: '0.25rem 0.75rem',
                              background: `${colors.warning}20`,
                              color: colors.warning,
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: '600'
                            }}>
                              {campaign.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button style={{
                        padding: '0.75rem 1.5rem',
                        background: `${colors.danger}20`,
                        border: `1px solid ${colors.danger}`,
                        borderRadius: '8px',
                        color: colors.danger,
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = colors.danger;
                        e.currentTarget.style.color = 'white';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = `${colors.danger}20`;
                        e.currentTarget.style.color = colors.danger;
                      }}>
                        Cancel Campaign
                      </button>
                    </div>
                  ))}
                  <div style={{
                    fontSize: '0.75rem',
                    color: 'rgba(255, 255, 255, 0.6)',
                    padding: '1rem',
                    background: 'rgba(249, 115, 22, 0.1)',
                    border: '1px solid rgba(249, 115, 22, 0.3)',
                    borderRadius: '8px',
                    lineHeight: '1.5'
                  }}>
                    <strong>Cancellation Policy:</strong> You can cancel any campaign up to 24 hours before the start date for a full refund. Cancellations within 24 hours of the start date are non-refundable.
                  </div>
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)' }}>
                  <Calendar size={32} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                  <div>No upcoming campaigns</div>
                </div>
              )}
            </div>

            {/* Past Campaign Performance with Total Spend */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '2rem',
              marginBottom: '2rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <BarChart3 size={20} style={{ color: colors.secondary }} />
                  Past Campaign Performance
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button style={{
                    padding: '0.5rem 1rem',
                    background: `${colors.success}20`,
                    border: `1px solid ${colors.success}`,
                    borderRadius: '6px',
                    color: colors.success,
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <Download size={14} />
                    CSV
                  </button>
                  <button style={{
                    padding: '0.5rem 1rem',
                    background: `${colors.accent}20`,
                    border: `1px solid ${colors.accent}`,
                    borderRadius: '6px',
                    color: colors.accent,
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <Download size={14} />
                    XLSX
                  </button>
                </div>
              </div>
              
              {/* Total Spend Summary */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1rem',
                marginBottom: '1.5rem'
              }}>
                <div style={{
                  padding: '1rem',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.5rem' }}>Total Spend (All Time)</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', fontFamily: '"Space Mono", monospace', color: colors.secondary }}>
                    ${advertisingHistory.reduce((sum, c) => sum + c.cost, 0).toLocaleString()}
                  </div>
                </div>
                <div style={{
                  padding: '1rem',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.5rem' }}>Total Clicks</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', fontFamily: '"Space Mono", monospace', color: colors.primary }}>
                    {advertisingHistory.reduce((sum, c) => sum + c.clicks, 0).toLocaleString()}
                  </div>
                </div>
                <div style={{
                  padding: '1rem',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.5rem' }}>Total Conversions</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', fontFamily: '"Space Mono", monospace', color: colors.success }}>
                    {advertisingHistory.reduce((sum, c) => sum + c.conversions, 0).toLocaleString()}
                  </div>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600' }}>Campaign</th>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600' }}>Start Date</th>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600' }}>End Date</th>
                      <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600' }}>Cost</th>
                      <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600' }}>Clicks</th>
                      <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600' }}>Conversions</th>
                      <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600' }}>ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {advertisingHistory.map((campaign, idx) => {
                      const roi = ((campaign.conversions * 52.03 - campaign.cost) / campaign.cost * 100).toFixed(1);
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                          <td style={{ padding: '1rem', fontSize: '0.875rem', fontWeight: '600' }}>{campaign.campaign}</td>
                          <td style={{ padding: '1rem', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.7)' }}>{campaign.startDate}</td>
                          <td style={{ padding: '1rem', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.7)' }}>{campaign.endDate}</td>
                          <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: '"Space Mono", monospace' }}>${campaign.cost.toLocaleString()}</td>
                          <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: '"Space Mono", monospace' }}>{campaign.clicks.toLocaleString()}</td>
                          <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: '"Space Mono", monospace', color: colors.success }}>{campaign.conversions}</td>
                          <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: '"Space Mono", monospace', color: parseFloat(roi) > 0 ? colors.success : colors.danger, fontWeight: '700' }}>
                            {roi}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Premium Add-ons */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '2rem',
              marginBottom: '2rem'
            }}>
              <div style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem', color: colors.purple }}>
                Premium Add-ons
              </div>
              <div style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '1.5rem' }}>
                Enhance your Premium subscription with additional features
              </div>
              <div style={{ display: 'grid', gap: '1rem' }}>
                {[
                  { feature: 'Add 5 videos/day', price: '+$50/month', id: 'video5' },
                  { feature: 'Increase live video capacity to 15', price: '+$50/month', id: 'capacity15' },
                  { feature: 'Increase live video capacity to 30', price: '+$100/month', id: 'capacity30' }
                ].map((addon, idx) => {
                  const isActive = subscription.addOns.some(a => a.includes(addon.feature));
                  return (
                    <div key={idx} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '1rem',
                      background: isActive ? 'rgba(20, 184, 166, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                      borderRadius: '8px',
                      border: isActive ? `1px solid ${colors.primary}40` : '1px solid rgba(255, 255, 255, 0.05)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <input type="checkbox" defaultChecked={isActive} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                        <span style={{ fontWeight: '500' }}>{addon.feature}</span>
                      </div>
                      <span style={{ fontFamily: '"Space Mono", monospace', color: isActive ? colors.primary : '#f59e0b', fontWeight: '700' }}>
                        {addon.price}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Optional Services */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '2rem',
              marginBottom: '2rem'
            }}>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                marginBottom: '1rem',
                color: colors.accent
              }}>
                Optional Services
              </div>
              
              <div style={{
                background: tpmsEnabled ? 'rgba(20, 184, 166, 0.1)' : 'rgba(251, 191, 36, 0.1)',
                border: tpmsEnabled ? `1px solid ${colors.primary}` : '1px solid rgba(251, 191, 36, 0.3)',
                borderRadius: '12px',
                padding: '1.5rem'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  marginBottom: '1rem'
                }}>
                  <input
                    type="checkbox"
                    checked={tpmsEnabled}
                    onChange={(e) => setTpmsEnabled(e.target.checked)}
                    style={{
                      width: '20px',
                      height: '20px',
                      cursor: 'pointer',
                      marginTop: '0.125rem',
                      flexShrink: 0
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      marginBottom: '0.5rem'
                    }}>
                      <div style={{ fontWeight: '700', fontSize: '1.125rem' }}>
                        Total Profile Management Services (TPMS)
                      </div>
                      {tpmsEnabled && (
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          background: colors.primary,
                          color: 'white',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          textTransform: 'uppercase'
                        }}>
                          Active
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: '1.25rem',
                      fontWeight: '800',
                      fontFamily: '"Space Mono", monospace',
                      color: colors.warning,
                      marginBottom: '0.75rem'
                    }}>
                      $200/month
                    </div>
                    <div style={{
                      fontSize: '0.875rem',
                      lineHeight: '1.6',
                      color: 'rgba(255, 255, 255, 0.8)'
                    }}>
                      We'll handle receipt reviews and approvals for you, keep your profile updated with fresh uploads, and manage your payout ladder settings for optimal performance.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Advertising Campaigns */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: '16px',
              padding: '2rem'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '1rem'
              }}>
                <TrendingUp size={24} style={{ color: colors.success }} />
                <div style={{
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>
                  Boost Your Visibility with Advertising
                </div>
              </div>
              <div style={{
                fontSize: '0.9rem',
                color: 'rgba(255, 255, 255, 0.7)',
                marginBottom: '2rem'
              }}>
                Want even more customers? Add targeted advertising campaigns
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem'
              }}>
                {[
                  {
                    name: '1-Day Spotlight',
                    price: '$99',
                    description: 'Featured at top of Discovery feed for 1 day in your category (within 20 miles of your business zip code)',
                    color: colors.accent
                  },
                  {
                    name: '7-Day Spotlight',
                    price: '$599',
                    description: 'Featured at top of Discovery feed for 7 days in your category (within 50 miles of your zip code)',
                    color: colors.primary
                  },
                  {
                    name: '14-Day Spotlight',
                    price: '$999',
                    description: 'Featured at top of Discovery feed for 14 days in your category (within 50 miles of your zip code)',
                    color: colors.secondary
                  }
                ].map((campaign, idx) => (
                  <div key={idx} style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.borderColor = campaign.color;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: '-50%',
                      right: '-30%',
                      width: '200px',
                      height: '200px',
                      background: `radial-gradient(circle, ${campaign.color}30 0%, transparent 70%)`,
                      borderRadius: '50%'
                    }} />
                    <div style={{
                      fontSize: '1.25rem',
                      fontWeight: '700',
                      marginBottom: '0.5rem'
                    }}>
                      {campaign.name}
                    </div>
                    <div style={{
                      fontSize: '2rem',
                      fontWeight: '800',
                      fontFamily: '"Space Mono", monospace',
                      color: campaign.color,
                      marginBottom: '1rem'
                    }}>
                      {campaign.price}
                    </div>
                    <div style={{
                      fontSize: '0.875rem',
                      color: 'rgba(255, 255, 255, 0.7)',
                      lineHeight: '1.5',
                      marginBottom: '1.5rem',
                      minHeight: '60px'
                    }}>
                      {campaign.description}
                    </div>
                    <button 
                    onClick={() => {
                      setSelectedAdCampaign(campaign);
                      setShowAdDateModal(true);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: `${campaign.color}20`,
                      border: `1px solid ${campaign.color}`,
                      borderRadius: '8px',
                      color: campaign.color,
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = campaign.color;
                      e.currentTarget.style.color = 'white';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = `${campaign.color}20`;
                      e.currentTarget.style.color = campaign.color;
                    }}>
                      Select
                    </button>
                  </div>
                ))}
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem'
              }}>
                {[
                  {
                    name: '100 Mile Wide Push',
                    price: '$2,599',
                    description: 'Promoted to all users within 100 miles of your business zip code with push notifications for 7 days straight and top priority placement on Discovery page',
                    color: colors.success,
                    featured: true
                  },
                  {
                    name: 'Tour Wide Push',
                    price: '$4,599',
                    description: 'Promoted to all users within 100 miles of your business zip code with push notifications for 14 days total (split in 60-day range) and top priority placement on Discovery page for 7 days (priority days may be split up)',
                    color: colors.warning,
                    featured: true
                  }
                ].map((campaign, idx) => (
                  <div key={idx} style={{
                    background: campaign.featured 
                      ? `linear-gradient(135deg, ${campaign.color}20 0%, ${campaign.color}10 100%)`
                      : 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(10px)',
                    border: campaign.featured ? `2px solid ${campaign.color}` : '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = `0 8px 30px ${campaign.color}40`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}>
                    {campaign.featured && (
                      <div style={{
                        position: 'absolute',
                        top: '1rem',
                        right: '1rem',
                        background: campaign.color,
                        color: 'white',
                        padding: '0.375rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        Premium
                      </div>
                    )}
                    <div style={{
                      fontSize: '1.25rem',
                      fontWeight: '700',
                      marginBottom: '0.5rem'
                    }}>
                      {campaign.name}
                    </div>
                    <div style={{
                      fontSize: '2.25rem',
                      fontWeight: '800',
                      fontFamily: '"Space Mono", monospace',
                      color: campaign.color,
                      marginBottom: '1rem'
                    }}>
                      {campaign.price}
                    </div>
                    <div style={{
                      fontSize: '0.875rem',
                      color: 'rgba(255, 255, 255, 0.7)',
                      lineHeight: '1.5',
                      marginBottom: '1.5rem',
                      minHeight: '80px'
                    }}>
                      {campaign.description}
                    </div>
                    <button 
                    onClick={() => {
                      setSelectedAdCampaign(campaign);
                      setShowAdDateModal(true);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.875rem',
                      background: campaign.featured ? campaign.color : `${campaign.color}20`,
                      border: `1px solid ${campaign.color}`,
                      borderRadius: '8px',
                      color: campaign.featured ? 'white' : campaign.color,
                      fontWeight: '700',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'scale(1.02)';
                      e.currentTarget.style.boxShadow = `0 4px 20px ${campaign.color}60`;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}>
                      Select
                    </button>
                  </div>
                ))}
              </div>

              {/* Custom Advertising Option */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <input type="checkbox" style={{
                  width: '20px',
                  height: '20px',
                  cursor: 'pointer'
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                    I'd like a LetsGo rep to contact me about custom advertising plans
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                    Get personalized advertising solutions tailored to your business goals
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Plans & Billing Tab */}
        {activeTab === 'billing' && (
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            
            {/* Choose Your Plan */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '2rem'
            }}>
              <div style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                marginBottom: '0.5rem',
                textAlign: 'center'
              }}>
                Choose Your Package
              </div>
              <div style={{
                fontSize: '0.9rem',
                color: 'rgba(255, 255, 255, 0.6)',
                marginBottom: '2rem',
                textAlign: 'center'
              }}>
                Choose Basic or Premium. Advertising is an optional package you can add to either.
              </div>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '2rem',
                marginBottom: '2rem'
              }}>
                {/* Basic Plan */}
                <div style={{
                  background: subscription.plan === 'Basic' ? `rgba(249, 115, 22, 0.1)` : 'rgba(255, 255, 255, 0.02)',
                  border: subscription.plan === 'Basic' ? `2px solid ${colors.secondary}` : '2px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '16px',
                  padding: '2rem',
                  position: 'relative'
                }}>
                  {subscription.plan === 'Basic' && (
                    <div style={{
                      position: 'absolute',
                      top: '1rem',
                      right: '1rem',
                      background: colors.secondary,
                      color: 'white',
                      padding: '0.375rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '700'
                    }}>
                      CURRENT PLAN
                    </div>
                  )}
                  <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                      Basic
                    </div>
                    <div style={{ fontSize: '2.5rem', fontWeight: '800', color: colors.secondary, marginBottom: '0.25rem' }}>
                      No Upfront
                    </div>
                    <div style={{ fontSize: '2.5rem', fontWeight: '800', color: colors.secondary }}>
                      Costs
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                      Pay Later
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    {['Get discovered by local users', 'Pay only for real customers', 'Verified customers via receipt redemption system', 'No monthly subscription', 'No paying for clicks or views', 'Basic analytics', 'Zero risk'].map((feature, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.875rem' }}>
                        <CheckCircle size={16} style={{ color: colors.success, flexShrink: 0, marginTop: '0.125rem' }} />
                        <span>{feature}</span>
                      </div>
                    ))}
                    
                    {/* Feature Access Section */}
                    <div style={{
                      marginTop: '0.5rem',
                      paddingTop: '1rem',
                      borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      <div style={{
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        color: colors.secondary,
                        marginBottom: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        Feature Access
                      </div>
                      {[
                        'Access to Discovery',
                        'Access to 5v3v1',
                        'Access to Group Vote'
                      ].map((feature, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                          <CheckCircle size={16} style={{ color: colors.secondary, flexShrink: 0, marginTop: '0.125rem' }} />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (subscription.plan !== 'Basic') {
                        setSelectedPlanChange('Basic');
                        setShowPlanChangeModal(true);
                      }
                    }}
                    disabled={subscription.plan === 'Basic'}
                    style={{
                      width: '100%',
                      padding: '0.875rem',
                      background: subscription.plan === 'Basic' ? 'rgba(255, 255, 255, 0.1)' : colors.secondary,
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '0.875rem',
                      fontWeight: '700',
                      cursor: subscription.plan === 'Basic' ? 'not-allowed' : 'pointer',
                      opacity: subscription.plan === 'Basic' ? 0.5 : 1
                    }}
                  >
                    {subscription.plan === 'Basic' ? 'Current Plan' : 'Switch to Basic'}
                  </button>
                </div>

                {/* Premium Plan */}
                <div style={{
                  background: subscription.plan === 'Premium' ? `rgba(20, 184, 166, 0.1)` : 'rgba(255, 255, 255, 0.02)',
                  border: subscription.plan === 'Premium' ? `2px solid ${colors.primary}` : '2px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '16px',
                  padding: '2rem',
                  position: 'relative'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '-12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#fbbf24',
                    color: '#0f172a',
                    padding: '0.375rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: '800',
                    letterSpacing: '0.05em'
                  }}>
                    MOST POPULAR
                  </div>
                  {subscription.plan === 'Premium' && (
                    <div style={{
                      position: 'absolute',
                      top: '1rem',
                      right: '1rem',
                      background: colors.primary,
                      color: 'white',
                      padding: '0.375rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '700'
                    }}>
                      CURRENT PLAN
                    </div>
                  )}
                  <div style={{ textAlign: 'center', marginBottom: '1.5rem', marginTop: '0.5rem' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                      Premium Subscription
                    </div>
                    <div style={{ fontSize: '2.5rem', fontWeight: '800', color: colors.primary }}>
                      $100
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                      per month
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    {['Get discovered by local users', 'Verified customers via receipt redemption system', 'No paying for clicks or views', 'No LetsGo fee from Basic section', 'Upload 1 video daily', 'Up to 5 live videos at once', 'Priority placement', 'Detailed analytics dashboard'].map((feature, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.875rem' }}>
                        <CheckCircle size={16} style={{ color: colors.success, flexShrink: 0, marginTop: '0.125rem' }} />
                        <span>{feature}</span>
                      </div>
                    ))}
                    
                    {/* Feature Access Section */}
                    <div style={{
                      marginTop: '0.5rem',
                      paddingTop: '1rem',
                      borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      <div style={{
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        color: colors.primary,
                        marginBottom: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        Feature Access
                      </div>
                      {[
                        'Access to Everything in Basic',
                        'Access to Events',
                        'Access to User Experiences',
                        'Access to Date Night Generator'
                      ].map((feature, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                          <CheckCircle size={16} style={{ color: colors.primary, flexShrink: 0, marginTop: '0.125rem' }} />
                          <span style={{ fontWeight: idx === 0 ? '600' : '400' }}>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (subscription.plan !== 'Premium') {
                        setSelectedPlanChange('Premium');
                        setShowPlanChangeModal(true);
                      }
                    }}
                    disabled={subscription.plan === 'Premium'}
                    style={{
                      width: '100%',
                      padding: '0.875rem',
                      background: subscription.plan === 'Premium' ? 'rgba(255, 255, 255, 0.1)' : colors.primary,
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '0.875rem',
                      fontWeight: '700',
                      cursor: subscription.plan === 'Premium' ? 'not-allowed' : 'pointer',
                      opacity: subscription.plan === 'Premium' ? 0.5 : 1
                    }}
                  >
                    {subscription.plan === 'Premium' ? 'Current Plan' : 'Upgrade to Premium'}
                  </button>
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '2rem'
            }}>
              <div style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                marginBottom: '0.5rem'
              }}>
                Billing & Payment
              </div>
              <div style={{
                fontSize: '0.875rem',
                color: 'rgba(255, 255, 255, 0.6)',
                marginBottom: '2rem'
              }}>
                Secure payment setup to process your transactions smoothly.
              </div>

              {/* Security Notice */}
              <div style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '12px',
                padding: '1rem',
                marginBottom: '2rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}>
                <CheckCircle size={20} style={{ color: colors.success, flexShrink: 0 }} />
                <div style={{ fontSize: '0.875rem' }}>
                  Your payment information is encrypted and secure. We never store full card details.
                </div>
              </div>

              {/* Current Payment Method */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '1.5rem',
                marginBottom: '1.5rem'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem'
                }}>
                  <div style={{
                    fontSize: '1.125rem',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <DollarSign size={20} style={{ color: colors.primary }} />
                    Current Payment Method
                  </div>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    background: `${colors.success}20`,
                    color: colors.success,
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: '600'
                  }}>
                    Active
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.25rem' }}>
                      Payment Type
                    </div>
                    <div style={{ fontWeight: '600' }}>{bankInfo.type}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.25rem' }}>
                      Bank Name
                    </div>
                    <div style={{ fontWeight: '600' }}>{bankInfo.bankName}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.25rem' }}>
                      Account Number
                    </div>
                    <div style={{ fontFamily: '"Space Mono", monospace', fontWeight: '600' }}>
                      ****{bankInfo.accountLast4}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.25rem' }}>
                      Routing Number
                    </div>
                    <div style={{ fontFamily: '"Space Mono", monospace', fontWeight: '600' }}>
                      ****{bankInfo.routingLast4}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button style={{
                  padding: '0.75rem 1.5rem',
                  background: `${colors.primary}20`,
                  border: `1px solid ${colors.primary}`,
                  borderRadius: '8px',
                  color: colors.primary,
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = colors.primary;
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = `${colors.primary}20`;
                  e.currentTarget.style.color = colors.primary;
                }}>
                  Update Bank Account
                </button>
                <button style={{
                  padding: '0.75rem 1.5rem',
                  background: `rgba(255, 255, 255, 0.05)`,
                  border: `1px solid rgba(255, 255, 255, 0.2)`,
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }}>
                  Switch to Credit Card
                </button>
              </div>
            </div>

            {/* Monthly Billing Summary */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '2rem'
            }}>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <BarChart3 size={20} style={{ color: colors.primary }} />
                Monthly Billing Summary
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600' }}>Month</th>
                      <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600' }}>Premium</th>
                      <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600' }}>Add-ons</th>
                      <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600' }}>Progressive</th>
                      <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600' }}>Basic Fees</th>
                      <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600' }}>CC Fees</th>
                      <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600' }}>Advertising</th>
                      <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600' }}>Total</th>
                      <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600' }}>Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billingSummary.map((bill, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ padding: '1rem', fontSize: '0.875rem', fontWeight: '600' }}>{bill.month}</td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: '"Space Mono", monospace' }}>
                          ${bill.premiumFee}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: '"Space Mono", monospace' }}>
                          ${bill.addOns}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: '"Space Mono", monospace', color: colors.primary }}>
                          ${bill.progressivePayouts.toLocaleString()}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: '"Space Mono", monospace', color: colors.secondary }}>
                          ${bill.basicFees}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: '"Space Mono", monospace', color: colors.warning }}>
                          ${bill.ccFees}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: '"Space Mono", monospace' }}>
                          ${bill.advertising.toLocaleString()}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: '"Space Mono", monospace', fontWeight: '700', color: colors.success }}>
                          ${bill.total.toLocaleString()}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          <a href={bill.invoiceUrl} style={{
                            color: colors.accent,
                            textDecoration: 'none',
                            fontSize: '0.875rem',
                            fontWeight: '600'
                          }}>
                            View
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* Receipt Redemption System Tab */}
        {activeTab === 'receipts' && (
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            
            {/* Stats Overview */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem'
            }}>
              {[
                { label: 'Pending Review', value: pendingReceipts.length, icon: <Clock size={18} />, color: colors.warning },
                { label: 'Approved Today', value: 12, icon: <CheckCircle size={18} />, color: colors.success },
                { label: 'Total This Month', value: 247, icon: <BarChart3 size={18} />, color: colors.primary },
                { label: 'Avg Response Time', value: '1.2 hrs', icon: <TrendingUp size={18} />, color: colors.accent }
              ].map((item, idx) => (
                <div key={idx} style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '1.25rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: item.color }}>
                    {item.icon}
                    <span style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)' }}>{item.label}</span>
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: '700', fontFamily: '"Space Mono", monospace' }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Pending Receipts for Review */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '2rem'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem'
              }}>
                <div style={{
                  fontSize: '1.25rem',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <AlertCircle size={20} style={{ color: colors.warning }} />
                  Pending Receipt Approvals
                </div>
                
                {/* Bulk Actions */}
                {selectedReceipts.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button style={{
                      padding: '0.5rem 1rem',
                      background: `${colors.success}20`,
                      border: `1px solid ${colors.success}`,
                      borderRadius: '6px',
                      color: colors.success,
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <CheckCircle size={14} />
                      Approve ({selectedReceipts.length})
                    </button>
                    <button style={{
                      padding: '0.5rem 1rem',
                      background: `${colors.danger}20`,
                      border: `1px solid ${colors.danger}`,
                      borderRadius: '6px',
                      color: colors.danger,
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <X size={14} />
                      Reject ({selectedReceipts.length})
                    </button>
                  </div>
                )}
              </div>

              {pendingReceipts.length > 0 ? (
                <div style={{ display: 'grid', gap: '1.5rem' }}>
                  {pendingReceipts.map((receipt, idx) => (
                    <div key={idx} style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      padding: '1.5rem',
                      display: 'grid',
                      gridTemplateColumns: 'auto 200px 1fr auto',
                      gap: '1.5rem',
                      alignItems: 'center'
                    }}>
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={selectedReceipts.includes(receipt.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedReceipts([...selectedReceipts, receipt.id]);
                          } else {
                            setSelectedReceipts(selectedReceipts.filter(id => id !== receipt.id));
                          }
                        }}
                        style={{
                          width: '20px',
                          height: '20px',
                          cursor: 'pointer'
                        }}
                      />

                      {/* Receipt Thumbnail */}
                      <div style={{
                        width: '140px',
                        height: '200px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        background: 'rgba(255, 255, 255, 0.05)',
                        position: 'relative',
                        cursor: 'pointer'
                      }}>
                        <img 
                          src={receipt.receiptImage} 
                          alt="Receipt" 
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                        <div style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          background: 'rgba(0, 0, 0, 0.8)',
                          padding: '0.5rem',
                          display: 'flex',
                          justifyContent: 'center',
                          gap: '0.5rem'
                        }}>
                          <button style={{
                            background: 'none',
                            border: 'none',
                            color: colors.primary,
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: '600'
                          }}>
                            <Eye size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                            View
                          </button>
                          <button style={{
                            background: 'none',
                            border: 'none',
                            color: colors.accent,
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: '600'
                          }}>
                            <Download size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                            Download
                          </button>
                        </div>
                      </div>

                      {/* Receipt Details */}
                      <div>
                        <div style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                          {receipt.id}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.25rem' }}>
                          Customer: <strong>{receipt.customer}</strong> (Level {receipt.customerLevel})
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.75rem' }}>
                          Submitted: {receipt.date}
                        </div>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '0.5rem',
                          marginTop: '1rem'
                        }}>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)' }}>Subtotal</div>
                            <div style={{ fontSize: '1rem', fontWeight: '700', fontFamily: '"Space Mono", monospace' }}>
                              ${receipt.subtotal.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)' }}>Your Fee</div>
                            <div style={{ fontSize: '1rem', fontWeight: '700', fontFamily: '"Space Mono", monospace', color: colors.primary }}>
                              ${receipt.totalFees.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <button style={{
                          padding: '0.75rem 1.5rem',
                          background: `${colors.success}20`,
                          border: `2px solid ${colors.success}`,
                          borderRadius: '8px',
                          color: colors.success,
                          fontSize: '0.875rem',
                          fontWeight: '700',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = colors.success;
                          e.currentTarget.style.color = 'white';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = `${colors.success}20`;
                          e.currentTarget.style.color = colors.success;
                        }}>
                          <CheckCircle size={16} />
                          Approve
                        </button>
                        <button style={{
                          padding: '0.75rem 1.5rem',
                          background: `${colors.danger}20`,
                          border: `2px solid ${colors.danger}`,
                          borderRadius: '8px',
                          color: colors.danger,
                          fontSize: '0.875rem',
                          fontWeight: '700',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = colors.danger;
                          e.currentTarget.style.color = 'white';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = `${colors.danger}20`;
                          e.currentTarget.style.color = colors.danger;
                        }}>
                          <X size={16} />
                          Deny
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  padding: '3rem',
                  textAlign: 'center',
                  color: 'rgba(255, 255, 255, 0.5)'
                }}>
                  <CheckCircle size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                  <div style={{ fontSize: '1.125rem', fontWeight: '600' }}>No pending receipts</div>
                  <div style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>You're all caught up!</div>
                </div>
              )}
            </div>

            {/* Progressive Payout Settings */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '2rem'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '1rem'
              }}>
                <div style={{
                  fontSize: '1.25rem',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <Award size={20} style={{ color: colors.primary }} />
                  Progressive Payout Structure
                </div>
                <button style={{
                  padding: '0.5rem 1rem',
                  background: `${colors.primary}20`,
                  border: `1px solid ${colors.primary}`,
                  borderRadius: '6px',
                  color: colors.primary,
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = colors.primary;
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = `${colors.primary}20`;
                  e.currentTarget.style.color = colors.primary;
                }}>
                  <Settings size={14} />
                  Edit Structure
                </button>
              </div>
              
              {/* Current Structure Banner */}
              <div style={{
                background: 'rgba(20, 184, 166, 0.1)',
                border: '1px solid rgba(20, 184, 166, 0.2)',
                borderRadius: '12px',
                padding: '1rem 1.5rem',
                marginBottom: '1rem'
              }}>
                <div style={{ fontSize: '0.875rem', lineHeight: '1.6', color: 'rgba(255, 255, 255, 0.8)' }}>
                  <strong>Current Structure: Standard</strong><br />
                  Balanced payouts, recommended for most businesses. Rewards loyal customers progressively.
                </div>
              </div>
              
              {/* Change Limitation Notice */}
              <div style={{
                background: 'rgba(251, 191, 36, 0.1)',
                border: '1px solid rgba(251, 191, 36, 0.3)',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                marginBottom: '1.5rem',
                fontSize: '0.75rem',
                lineHeight: '1.5',
                color: 'rgba(255, 255, 255, 0.8)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem'
              }}>
                <AlertCircle size={16} style={{ color: colors.warning, flexShrink: 0, marginTop: '0.125rem' }} />
                <div>
                  <strong>Structure Change Limit:</strong> You can only change your progressive payout structure <span style={{ color: colors.warning, fontWeight: '700' }}>once per calendar year</span>. 
                  <span style={{ color: colors.success, fontWeight: '700' }}> Changes remaining in 2026: 1</span>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '0.75rem',
                marginBottom: '1rem'
              }}>
                {[
                  { level: 'Level 1', visits: '1-10 visits', payout: '3.00%', color: '#94a3b8' },
                  { level: 'Level 2', visits: '11-20 visits', payout: '4.00%', color: '#64748b' },
                  { level: 'Level 3', visits: '21-30 visits', payout: '5.00%', color: colors.accent },
                  { level: 'Level 4', visits: '31-40 visits', payout: '6.00%', color: colors.primary },
                  { level: 'Level 5', visits: '41-50 visits', payout: '7.00%', color: colors.secondary },
                  { level: 'Level 6', visits: '51-60 visits', payout: '8.00%', color: '#f59e0b' },
                  { level: 'Level 7', visits: '61+ visits', payout: '10.00%', color: colors.success }
                ].map((tier, idx) => (
                  <div key={idx} style={{
                    padding: '1rem',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontWeight: '700', marginBottom: '0.5rem', color: tier.color, fontSize: '0.875rem' }}>
                      {tier.level}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.75rem' }}>
                      {tier.visits}
                    </div>
                    <div style={{
                      fontFamily: '"Space Mono", monospace',
                      fontSize: '1.125rem',
                      fontWeight: '700',
                      color: idx === 6 ? colors.success : 'white'
                    }}>
                      {tier.payout}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Progressive Payout History */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '2rem'
            }}>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <DollarSign size={20} style={{ color: colors.success }} />
                Progressive Payout History
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600' }}>Date</th>
                      <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600' }}>Amount</th>
                      <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600' }}>Receipts</th>
                      <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600' }}>Payment Method</th>
                      <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '600' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payoutHistory.map((payout, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ padding: '1rem', fontSize: '0.875rem' }}>{payout.date}</td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: '"Space Mono", monospace', fontWeight: '700', color: colors.success }}>
                          ${payout.amount.toLocaleString()}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.875rem', fontFamily: '"Space Mono", monospace' }}>
                          {payout.receipts}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center', fontSize: '0.875rem' }}>
                          {payout.method}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          <span style={{ 
                            padding: '0.25rem 0.75rem', 
                            background: `${colors.success}20`, 
                            color: colors.success, 
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: '600'
                          }}>
                            {payout.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
        {/* Profile Settings Tab */}
        {activeTab === 'profile' && (
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            
            {/* Business Information */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '2rem'
            }}>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <Settings size={20} style={{ color: colors.primary }} />
                Business Information
              </div>
              <div style={{ display: 'grid', gap: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      marginBottom: '0.5rem',
                      color: 'rgba(255, 255, 255, 0.7)'
                    }}>
                      Business Name
                    </label>
                    <input
                      type="text"
                      defaultValue={businessData.name}
                      style={{
                        width: '100%',
                        padding: '0.875rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: 'white',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      marginBottom: '0.5rem',
                      color: 'rgba(255, 255, 255, 0.7)'
                    }}>
                      Business Type
                    </label>
                    <select
                      defaultValue={businessData.type}
                      style={{
                        width: '100%',
                        padding: '0.875rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: 'white',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit'
                      }}
                    >
                      <option value="Restaurant/Bar">Restaurant/Bar</option>
                      <option value="Salon/Beauty">Salon/Beauty</option>
                      <option value="Retail">Retail</option>
                      <option value="Activity">Activity</option>
                      <option value="Event Venue">Event Venue</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    marginBottom: '0.5rem',
                    color: 'rgba(255, 255, 255, 0.7)'
                  }}>
                    Street Address
                  </label>
                  <input
                    type="text"
                    defaultValue="14445 West Center Road"
                    style={{
                      width: '100%',
                      padding: '0.875rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '0.875rem',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1.5rem' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      marginBottom: '0.5rem',
                      color: 'rgba(255, 255, 255, 0.7)'
                    }}>
                      City
                    </label>
                    <input
                      type="text"
                      defaultValue="Springboro"
                      style={{
                        width: '100%',
                        padding: '0.875rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: 'white',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      marginBottom: '0.5rem',
                      color: 'rgba(255, 255, 255, 0.7)'
                    }}>
                      State
                    </label>
                    <select
                      defaultValue="AK"
                      style={{
                        width: '100%',
                        padding: '0.875rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: 'white',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit'
                      }}
                    >
                      <option value="AK">AK</option>
                      <option value="AL">AL</option>
                      <option value="AR">AR</option>
                      {/* Add more states */}
                    </select>
                  </div>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      marginBottom: '0.5rem',
                      color: 'rgba(255, 255, 255, 0.7)'
                    }}>
                      Zip Code
                    </label>
                    <input
                      type="text"
                      defaultValue="16435"
                      style={{
                        width: '100%',
                        padding: '0.875rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: 'white',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      marginBottom: '0.5rem',
                      color: 'rgba(255, 255, 255, 0.7)'
                    }}>
                      Phone
                    </label>
                    <input
                      type="tel"
                      defaultValue={businessData.phone}
                      style={{
                        width: '100%',
                        padding: '0.875rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: 'white',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      marginBottom: '0.5rem',
                      color: 'rgba(255, 255, 255, 0.7)'
                    }}>
                      Email
                    </label>
                    <input
                      type="email"
                      defaultValue={businessData.email}
                      style={{
                        width: '100%',
                        padding: '0.875rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: 'white',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      marginBottom: '0.5rem',
                      color: 'rgba(255, 255, 255, 0.7)'
                    }}>
                      Website
                    </label>
                    <input
                      type="url"
                      defaultValue={businessData.website}
                      style={{
                        width: '100%',
                        padding: '0.875rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: 'white',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    marginBottom: '0.5rem',
                    color: 'rgba(255, 255, 255, 0.7)'
                  }}>
                    Business Description / Hook
                  </label>
                  <textarea
                    defaultValue="Family-owned artisan bakery specializing in fresh-baked breads, pastries, and custom cakes. Using traditional techniques and locally-sourced ingredients since 2015."
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '0.875rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '0.875rem',
                      fontFamily: 'inherit',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      marginBottom: '0.5rem',
                      color: 'rgba(255, 255, 255, 0.7)'
                    }}>
                      Cuisine Type
                    </label>
                    <select
                      defaultValue="Bakery"
                      style={{
                        width: '100%',
                        padding: '0.875rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: 'white',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit'
                      }}
                    >
                      <option value="American">American</option>
                      <option value="Italian">Italian</option>
                      <option value="Mexican">Mexican</option>
                      <option value="Chinese">Chinese</option>
                      <option value="Japanese">Japanese</option>
                      <option value="BBQ">BBQ</option>
                      <option value="Bakery">Bakery</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      marginBottom: '0.5rem',
                      color: 'rgba(255, 255, 255, 0.7)'
                    }}>
                      Price Level
                    </label>
                    <select
                      defaultValue="$$"
                      style={{
                        width: '100%',
                        padding: '0.875rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: 'white',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit'
                      }}
                    >
                      <option value="$">$ - Inexpensive</option>
                      <option value="$$">$$ - Moderate</option>
                      <option value="$$$">$$$ - Expensive</option>
                      <option value="$$$$">$$$$ - Very Expensive</option>
                    </select>
                  </div>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      marginBottom: '0.5rem',
                      color: 'rgba(255, 255, 255, 0.7)'
                    }}>
                      Age Restriction
                    </label>
                    <select
                      defaultValue="None"
                      style={{
                        width: '100%',
                        padding: '0.875rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: 'white',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit'
                      }}
                    >
                      <option value="None">None</option>
                      <option value="18+">18+</option>
                      <option value="21+">21+</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    marginBottom: '0.5rem',
                    color: 'rgba(255, 255, 255, 0.7)'
                  }}>
                    Tags
                  </label>
                  
                  {/* Selected Tags Display */}
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    marginBottom: '0.75rem',
                    padding: '0.75rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    minHeight: '3rem'
                  }}>
                    {selectedTags.map((tag, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.375rem 0.75rem',
                        background: colors.primary,
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        fontWeight: '500'
                      }}>
                        {tag}
                        <button
                          onClick={() => setSelectedTags(selectedTags.filter((_, i) => i !== idx))}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer',
                            padding: '0',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  {/* Tag Input with Autocomplete */}
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => {
                        const value = e.target.value;
                        setTagInput(value);
                        if (value) {
                          const filtered = availableTags.filter(tag => 
                            tag.toLowerCase().includes(value.toLowerCase()) && 
                            !selectedTags.includes(tag)
                          );
                          setFilteredTags(filtered);
                        } else {
                          setFilteredTags([]);
                        }
                      }}
                      placeholder="Type to search tags..."
                      style={{
                        width: '100%',
                        padding: '0.875rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: 'white',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit'
                      }}
                    />
                    
                    {/* Autocomplete Dropdown */}
                    {filteredTags.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '0.5rem',
                        background: 'rgba(15, 23, 42, 0.98)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        zIndex: 10
                      }}>
                        {filteredTags.map((tag, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              setSelectedTags([...selectedTags, tag]);
                              setTagInput('');
                              setFilteredTags([]);
                            }}
                            style={{
                              padding: '0.75rem 1rem',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              borderBottom: idx < filteredTags.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            {tag}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '0.5rem' }}>
                    These tags help users find your business when filtering. Select from predefined options.
                  </div>
                </div>
              </div>
            </div>

            {/* Business Representative */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '2rem'
            }}>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <Users size={20} style={{ color: colors.primary }} />
                Business Representative Contact
              </div>
              <div style={{ display: 'grid', gap: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      marginBottom: '0.5rem',
                      color: 'rgba(255, 255, 255, 0.7)'
                    }}>
                      Full Name
                    </label>
                    <input
                      type="text"
                      defaultValue="Jennifer Skinner"
                      style={{
                        width: '100%',
                        padding: '0.875rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: 'white',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      marginBottom: '0.5rem',
                      color: 'rgba(255, 255, 255, 0.7)'
                    }}>
                      Title/Role
                    </label>
                    <input
                      type="text"
                      defaultValue="Owner / General Manager"
                      style={{
                        width: '100%',
                        padding: '0.875rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: 'white',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      marginBottom: '0.5rem',
                      color: 'rgba(255, 255, 255, 0.7)'
                    }}>
                      Contact Email
                    </label>
                    <input
                      type="email"
                      defaultValue="jennifer.skinner@jskinnerybaking.com"
                      style={{
                        width: '100%',
                        padding: '0.875rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: 'white',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      marginBottom: '0.5rem',
                      color: 'rgba(255, 255, 255, 0.7)'
                    }}>
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      defaultValue="(402) 515-0880"
                      style={{
                        width: '100%',
                        padding: '0.875rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: 'white',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Business User Information */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '2rem'
            }}>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <Users size={20} style={{ color: colors.secondary }} />
                Business User Login Information
              </div>
              <div style={{ display: 'grid', gap: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      marginBottom: '0.5rem',
                      color: 'rgba(255, 255, 255, 0.7)'
                    }}>
                      Login Email
                    </label>
                    <input
                      type="email"
                      defaultValue="christopher.olson81@ymail.com"
                      style={{
                        width: '100%',
                        padding: '0.875rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: 'white',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      marginBottom: '0.5rem',
                      color: 'rgba(255, 255, 255, 0.7)'
                    }}>
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      defaultValue="(463) 745-3743"
                      style={{
                        width: '100%',
                        padding: '0.875rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: 'white',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                </div>
                <div>
                  <button style={{
                    padding: '0.75rem 1.5rem',
                    background: `${colors.warning}20`,
                    border: `1px solid ${colors.warning}`,
                    borderRadius: '8px',
                    color: colors.warning,
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = colors.warning;
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = `${colors.warning}20`;
                    e.currentTarget.style.color = colors.warning;
                  }}>
                    Change Password
                  </button>
                </div>
              </div>
            </div>

            {/* Operating Hours */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '2rem'
            }}>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <Clock size={20} style={{ color: colors.primary }} />
                Operating Hours
              </div>
              <div style={{ display: 'grid', gap: '1rem' }}>
                {Object.entries(businessData.hours).map(([day, hours]) => (
                  <div key={day} style={{
                    display: 'grid',
                    gridTemplateColumns: '140px 1fr 1fr 50px',
                    gap: '1rem',
                    alignItems: 'center',
                    padding: '0.75rem',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '8px'
                  }}>
                    <div style={{
                      fontWeight: '600',
                      textTransform: 'capitalize',
                      fontSize: '0.875rem'
                    }}>
                      {day}
                    </div>
                    <input
                      type="time"
                      defaultValue={hours.open !== 'Closed' ? hours.open : ''}
                      disabled={hours.open === 'Closed'}
                      style={{
                        padding: '0.75rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '6px',
                        color: 'white',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit'
                      }}
                    />
                    <input
                      type="time"
                      defaultValue={hours.close}
                      disabled={hours.open === 'Closed'}
                      style={{
                        padding: '0.75rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '6px',
                        color: 'white',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit'
                      }}
                    />
                    <input
                      type="checkbox"
                      defaultChecked={hours.open !== 'Closed'}
                      style={{
                        width: '20px',
                        height: '20px',
                        cursor: 'pointer'
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Account Actions */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '2rem'
            }}>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: colors.danger
              }}>
                <AlertCircle size={20} style={{ color: colors.danger }} />
                Account Actions
              </div>
              
              <div style={{
                background: 'rgba(239, 68, 68, 0.05)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '12px',
                padding: '1.5rem',
                marginBottom: '1.5rem'
              }}>
                <div style={{ fontSize: '0.875rem', lineHeight: '1.6', color: 'rgba(255, 255, 255, 0.7)' }}>
                  <strong>Warning:</strong> These actions will affect your account status. Please review carefully before proceeding.
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <button style={{
                  padding: '0.875rem 1.5rem',
                  background: `${colors.success}20`,
                  border: `1px solid ${colors.success}`,
                  borderRadius: '8px',
                  color: colors.success,
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = colors.success;
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = `${colors.success}20`;
                  e.currentTarget.style.color = colors.success;
                }}>
                  <CheckCircle size={16} />
                  Reinstate Account
                </button>

                <button style={{
                  padding: '0.875rem 1.5rem',
                  background: `${colors.warning}20`,
                  border: `1px solid ${colors.warning}`,
                  borderRadius: '8px',
                  color: colors.warning,
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = colors.warning;
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = `${colors.warning}20`;
                  e.currentTarget.style.color = colors.warning;
                }}>
                  <Clock size={16} />
                  Put Account on Hold
                </button>

                <button style={{
                  padding: '0.875rem 1.5rem',
                  background: `${colors.danger}20`,
                  border: `1px solid ${colors.danger}`,
                  borderRadius: '8px',
                  color: colors.danger,
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = colors.danger;
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = `${colors.danger}20`;
                  e.currentTarget.style.color = colors.danger;
                }}>
                  <AlertCircle size={16} />
                  Delete Account
                </button>
              </div>

              <div style={{
                fontSize: '0.75rem',
                color: 'rgba(255, 255, 255, 0.5)',
                marginTop: '1rem',
                lineHeight: '1.5'
              }}>
                <strong>Put on Hold:</strong> Temporarily pause your account. Your profile will be hidden from users until reactivated.<br />
                <strong>Delete Account:</strong> Permanently delete your account and all associated data. This action cannot be undone.
              </div>
            </div>

          </div>
        )}
        {/* Support & Help Tab */}
        {activeTab === 'support' && (
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            
            {/* Quick Actions */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1rem'
            }}>
              <div style={{
                background: `linear-gradient(135deg, ${colors.primary}20 0%, ${colors.primary}05 100%)`,
                border: `1px solid ${colors.primary}40`,
                borderRadius: '12px',
                padding: '1.5rem',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                <Mail size={32} style={{ color: colors.primary, marginBottom: '1rem' }} />
                <div style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem' }}>Email Support</div>
                <div style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                  support@letsgo.com
                </div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '0.5rem' }}>
                  Response within 24 hours
                </div>
              </div>

              <div style={{
                background: `linear-gradient(135deg, ${colors.secondary}20 0%, ${colors.secondary}05 100%)`,
                border: `1px solid ${colors.secondary}40`,
                borderRadius: '12px',
                padding: '1.5rem',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                <Phone size={32} style={{ color: colors.secondary, marginBottom: '1rem' }} />
                <div style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem' }}>Phone Support</div>
                <div style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                  1-800-LETSGO-1
                </div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '0.5rem' }}>
                  Mon-Fri 9AM-6PM EST
                </div>
              </div>

              <div style={{
                background: `linear-gradient(135deg, ${colors.accent}20 0%, ${colors.accent}05 100%)`,
                border: `1px solid ${colors.accent}40`,
                borderRadius: '12px',
                padding: '1.5rem',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                <MessageSquare size={32} style={{ color: colors.accent, marginBottom: '1rem' }} />
                <div style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem' }}>Live Chat</div>
                <div style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                  Chat with our team
                </div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '0.5rem' }}>
                  Available now
                </div>
              </div>
            </div>

            {/* FAQ Section */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '2rem'
            }}>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <HelpCircle size={20} style={{ color: colors.primary }} />
                Frequently Asked Questions
              </div>
              <div style={{ display: 'grid', gap: '1rem' }}>
                {[
                  { 
                    question: "How do I approve customer receipts?",
                    answer: "Go to the Receipt Redemption System page, review the receipt image, and click 'Approve' or 'Deny'. You have 48 hours to respond before automatic approval."
                  },
                  {
                    question: "What happens if I don't approve a receipt within 48 hours?",
                    answer: "Receipts are automatically approved after 48 hours of no response to ensure customers receive their rewards promptly."
                  },
                  {
                    question: "Can I cancel my advertising campaign?",
                    answer: "Yes, you can cancel any campaign up to 24 hours before the start date for a full refund. Cancellations within 24 hours are non-refundable."
                  },
                  {
                    question: "How does the progressive payout system work?",
                    answer: "As customers visit more frequently, they advance through 7 loyalty levels. Higher levels earn you lower fees (3%-10%) as a reward for building customer loyalty."
                  },
                  {
                    question: "What's the difference between Basic and Premium plans?",
                    answer: "Basic has no monthly fee - you only pay per verified transaction. Premium ($100/month) removes the basic transaction fee and adds video uploads, priority placement, and advanced analytics."
                  },
                  {
                    question: "How do I update my payment information?",
                    answer: "Go to Plans & Billing, scroll to the Billing & Payment section, and click 'Update Bank Account' or 'Switch to Credit Card'."
                  }
                ].map((faq, idx) => (
                  <div key={idx} style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '1.5rem'
                  }}>
                    <div style={{
                      fontSize: '1rem',
                      fontWeight: '700',
                      marginBottom: '0.75rem',
                      color: colors.primary
                    }}>
                      {faq.question}
                    </div>
                    <div style={{
                      fontSize: '0.875rem',
                      lineHeight: '1.6',
                      color: 'rgba(255, 255, 255, 0.8)'
                    }}>
                      {faq.answer}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notification Preferences */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '2rem'
            }}>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <Bell size={20} style={{ color: colors.secondary }} />
                Notification Preferences
              </div>
              <div style={{
                fontSize: '0.875rem',
                color: 'rgba(255, 255, 255, 0.6)',
                marginBottom: '2rem'
              }}>
                Manage how you receive updates and alerts
              </div>

              {/* Email Notifications */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  marginBottom: '1rem',
                  color: colors.primary
                }}>
                  <Mail size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
                  Email Notifications
                </div>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {[
                    { id: 'newReceipts', label: 'New Receipt Submissions', checked: true },
                    { id: 'receiptApprovals', label: 'Receipt Approval Confirmations', checked: true },
                    { id: 'campaignUpdates', label: 'Advertising Campaign Updates', checked: true },
                    { id: 'weeklyReports', label: 'Weekly Performance Reports', checked: false },
                    { id: 'monthlyInvoices', label: 'Monthly Invoices', checked: true }
                  ].map((item, idx) => (
                    <label key={idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '1rem',
                      background: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'}>
                      <input
                        type="checkbox"
                        defaultChecked={item.checked}
                        style={{
                          width: '18px',
                          height: '18px',
                          cursor: 'pointer'
                        }}
                      />
                      <span style={{ fontSize: '0.875rem' }}>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* SMS Notifications */}
              <div>
                <div style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  marginBottom: '1rem',
                  color: colors.secondary
                }}>
                  <MessageSquare size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
                  SMS Notifications
                </div>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {[
                    { id: 'urgentAlerts', label: 'Urgent Account Alerts', checked: true },
                    { id: 'receiptReminders', label: 'Receipt Approval Reminders', checked: false },
                    { id: 'campaignStart', label: 'Campaign Start Notifications', checked: true }
                  ].map((item, idx) => (
                    <label key={idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '1rem',
                      background: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'}>
                      <input
                        type="checkbox"
                        defaultChecked={item.checked}
                        style={{
                          width: '18px',
                          height: '18px',
                          cursor: 'pointer'
                        }}
                      />
                      <span style={{ fontSize: '0.875rem' }}>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{
                marginTop: '2rem',
                padding: '1rem',
                background: 'rgba(6, 182, 212, 0.1)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                borderRadius: '8px',
                fontSize: '0.875rem',
                lineHeight: '1.5',
                color: 'rgba(255, 255, 255, 0.8)'
              }}>
                <strong>Note:</strong> You'll always receive critical notifications related to account security, payment issues, and terms of service updates regardless of these settings.
             </div>
    </div>
  </div>
)}


      {/* Create/Edit Event Modal */}
      {showCreateEventModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '2rem'
        }}
        onClick={() => setShowCreateEventModal(false)}>
          <div style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            borderRadius: '20px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}
          onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{
              padding: '2rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                  {editingEvent ? 'Edit Event' : 'Create New Event'}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                  {editingEvent ? 'Update event details' : 'Fill in the details to create your event'}
                </div>
              </div>
              <button
                onClick={() => setShowCreateEventModal(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  borderRadius: '8px',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'white'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '2rem' }}>
              {/* Event Image Upload */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600' }}>
                  Event Image *
                </label>
                <div style={{
                  border: '2px dashed rgba(255, 255, 255, 0.2)',
                  borderRadius: '12px',
                  padding: '2rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = colors.primary}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'}>
                  <Upload size={32} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                  <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                    Drop image here or click to upload
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                    PNG, JPG up to 10MB
                  </div>
                </div>
              </div>

              {/* Event Title */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600' }}>
                  Event Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g., Live Jazz Night, Bingo Night, Karaoke Wednesday"
                  defaultValue={editingEvent?.title || ''}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '0.875rem'
                  }}
                />
              </div>

              {/* Category Dropdown */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600' }}>
                  Category *
                </label>
                <select
                  defaultValue={editingEvent?.category || ''}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '0.875rem'
                  }}
                >
                  <option value="">Select a category</option>
                  <option value="Music">Music</option>
                  <option value="Games">Games</option>
                  <option value="Food & Drink">Food & Drink</option>
                  <option value="Workshop">Workshop</option>
                  <option value="Special Event">Special Event</option>
                  <option value="Sports">Sports</option>
                  <option value="Arts & Crafts">Arts & Crafts</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Description */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600' }}>
                  Description *
                </label>
                <textarea
                  placeholder="Describe your event..."
                  defaultValue={editingEvent?.description || ''}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '0.875rem',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Event Date & Time */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600' }}>
                    Event Date *
                  </label>
                  <input
                    type="date"
                    defaultValue={editingEvent?.date || ''}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600' }}>
                    Time Range *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., 7:00 PM - 10:00 PM"
                    defaultValue={editingEvent?.time || ''}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>
              </div>

              {/* Price & Capacity */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600' }}>
                    Price *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Free, $10, $5 per card"
                    defaultValue={editingEvent?.price || ''}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600' }}>
                    Capacity (Optional)
                  </label>
                  <input
                    type="number"
                    placeholder="Max attendees"
                    defaultValue={editingEvent?.capacity || ''}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>
              </div>

              {/* External Booking URL */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '600' }}>
                  External Booking URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/tickets"
                  defaultValue={editingEvent?.bookingUrl || ''}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '0.875rem'
                  }}
                />
                <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '0.5rem' }}>
                  Link to external ticketing or RSVP platform
                </div>
              </div>

              {/* Options Checkboxes */}
              <div style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.875rem', fontWeight: '600' }}>
                  Options
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {[
                    { label: 'Publish event immediately', checked: true },
                    { label: 'Send push notification to nearby users', checked: false },
                    { label: 'Require RSVP', checked: false },
                    { label: 'Repeat event (weekly)', checked: false }
                  ].map((option, idx) => (
                    <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        defaultChecked={option.checked}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.875rem' }}>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '1.5rem 2rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              gap: '1rem',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setShowCreateEventModal(false)}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                style={{
                  padding: '0.75rem 1.5rem',
                  background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.accent} 100%)`,
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: `0 4px 20px ${colors.primary}60`
                }}
              >
                {editingEvent ? 'Update Event' : 'Create Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Upload Modal */}
      {showPhotoUploadModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '2rem'
        }} onClick={() => setShowPhotoUploadModal(false)}>
          <div style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '500px',
            width: '100%'
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <Camera size={24} style={{ color: colors.primary }} />
              Upload Photos
            </div>
            
            <div style={{ display: 'grid', gap: '1.5rem' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  marginBottom: '0.5rem',
                  color: 'rgba(255, 255, 255, 0.7)'
                }}>
                  Photo Title
                </label>
                <input
                  type="text"
                  placeholder="Enter a descriptive title..."
                  style={{
                    width: '100%',
                    padding: '0.875rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  marginBottom: '0.5rem',
                  color: 'rgba(255, 255, 255, 0.7)'
                }}>
                  Description (Optional)
                </label>
                <textarea
                  placeholder="Add a description..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.875rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  marginBottom: '0.5rem',
                  color: 'rgba(255, 255, 255, 0.7)'
                }}>
                  Select Photos
                </label>
                <div style={{
                  padding: '2rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '2px dashed rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  textAlign: 'center',
                  cursor: 'pointer'
                }}>
                  <Upload size={32} style={{ color: colors.primary, margin: '0 auto 0.5rem' }} />
                  <div style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                    Click to browse or drag and drop
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)', marginTop: '0.25rem' }}>
                    JPG, PNG up to 10MB
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button
                onClick={() => setShowPhotoUploadModal(false)}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.accent} 100%)`,
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Upload Photos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Upload Modal */}
      {showVideoUploadModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '2rem'
        }} onClick={() => setShowVideoUploadModal(false)}>
          <div style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '500px',
            width: '100%'
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <Video size={24} style={{ color: colors.secondary }} />
              Upload Video
            </div>
            
            <div style={{ display: 'grid', gap: '1.5rem' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  marginBottom: '0.5rem',
                  color: 'rgba(255, 255, 255, 0.7)'
                }}>
                  Video Title
                </label>
                <input
                  type="text"
                  placeholder="Enter a descriptive title..."
                  style={{
                    width: '100%',
                    padding: '0.875rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  marginBottom: '0.5rem',
                  color: 'rgba(255, 255, 255, 0.7)'
                }}>
                  Description (Optional)
                </label>
                <textarea
                  placeholder="Add a description..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.875rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  marginBottom: '0.5rem',
                  color: 'rgba(255, 255, 255, 0.7)'
                }}>
                  <input type="checkbox" style={{ width: '16px', height: '16px' }} />
                  Set as active video
                </label>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', marginLeft: '1.5rem' }}>
                  Active videos appear in your business profile
                </div>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  marginBottom: '0.5rem',
                  color: 'rgba(255, 255, 255, 0.7)'
                }}>
                  Select Video
                </label>
                <div style={{
                  padding: '2rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '2px dashed rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  textAlign: 'center',
                  cursor: 'pointer'
                }}>
                  <Upload size={32} style={{ color: colors.secondary, margin: '0 auto 0.5rem' }} />
                  <div style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                    Click to browse or drag and drop
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)', marginTop: '0.25rem' }}>
                    MP4, MOV up to 100MB, max 60 seconds
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button
                onClick={() => setShowVideoUploadModal(false)}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  background: `linear-gradient(135deg, ${colors.secondary} 0%, ${colors.warning} 100%)`,
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Upload Video
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan Change Confirmation Modal */}
      {showPlanChangeModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '2rem'
        }} onClick={() => setShowPlanChangeModal(false)}>
          <div style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '450px',
            width: '100%'
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              marginBottom: '1rem'
            }}>
              {selectedPlanChange === 'Premium' ? 'Upgrade to Premium?' : 'Switch to Basic?'}
            </div>
            
            {selectedPlanChange === 'Premium' && (
              <div style={{
                background: 'rgba(249, 115, 22, 0.1)',
                border: '1px solid rgba(249, 115, 22, 0.3)',
                borderRadius: '12px',
                padding: '1rem',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem'
              }}>
                <AlertCircle size={20} style={{ color: colors.secondary, flexShrink: 0, marginTop: '0.125rem' }} />
                <div style={{ fontSize: '0.875rem', lineHeight: '1.5' }}>
                  <strong>Immediate Billing:</strong> When upgrading from Basic to Premium, you will be charged the full $100 monthly fee immediately, prorated for the current billing period.
                </div>
              </div>
            )}

            <div style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '2rem', lineHeight: '1.6' }}>
              {selectedPlanChange === 'Premium' 
                ? 'You\'ll get immediate access to all Premium features including video uploads, priority placement, and detailed analytics.'
                : 'Switching to Basic will remove Premium features at the end of your current billing period. You\'ll now be paying the LetsGo Fee, Progressive Payout Fee, and the Credit Card Fee (if using a Credit Card) for verified customer transactions.'}
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => setShowPlanChangeModal(false)}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  background: selectedPlanChange === 'Premium' 
                    ? `linear-gradient(135deg, ${colors.primary} 0%, ${colors.accent} 100%)`
                    : `linear-gradient(135deg, ${colors.secondary} 0%, ${colors.warning} 100%)`,
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Confirm Change
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legal Disclaimer Modal */}
      {showLegalDisclaimerModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '2rem'
        }} onClick={() => setShowLegalDisclaimerModal(false)}>
          <div style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column'
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              marginBottom: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <AlertCircle size={24} style={{ color: colors.warning }} />
              Terms & Conditions Agreement
            </div>
            
            <div style={{
              fontSize: '0.75rem',
              color: colors.warning,
              fontWeight: '600',
              marginBottom: '0.5rem'
            }}>
              Last Updated: January 2, 2026
            </div>
            
            <div style={{
              fontSize: '0.875rem',
              color: 'rgba(255, 255, 255, 0.6)',
              marginBottom: '1.5rem'
            }}>
              Please read carefully before publishing changes
            </div>

            {/* Scrollable Content */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.5rem',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              marginBottom: '1.5rem',
              fontSize: '0.875rem',
              lineHeight: '1.6',
              color: 'rgba(255, 255, 255, 0.8)'
            }}>
              <h3 style={{ color: colors.primary, marginBottom: '1rem', fontSize: '1rem' }}>
                1. Binding Agreement
              </h3>
              <p style={{ marginBottom: '1rem' }}>
                By clicking "Confirm & Publish," you ("Business," "you," or "your") enter into a legally binding agreement with LetsGo ("Company," "we," "us," or "our"). You acknowledge that you have read, understood, and agree to be bound by these terms and conditions, along with our Business Billing Policy, Privacy Policy, and all other applicable policies incorporated herein by reference.
              </p>

              <h3 style={{ color: colors.primary, marginBottom: '1rem', fontSize: '1rem' }}>
                2. Payment Terms & Authorization
              </h3>
              <p style={{ marginBottom: '0.5rem' }}>
                You authorize LetsGo to charge your designated payment method for:
              </p>
              <ul style={{ marginBottom: '1rem', paddingLeft: '1.5rem' }}>
                <li>Subscription fees (if applicable) charged monthly in advance</li>
                <li>Progressive payout fees based on verified customer transactions</li>
                <li>Platform fees (Basic tier: 10% of receipt subtotal or $5, whichever is less)</li>
                <li>Credit card processing fees (3.5% when using credit/debit card payments)</li>
                <li>Advertising campaign fees as selected and confirmed</li>
                <li>Optional service fees (e.g., TPMS) as elected</li>
                <li>Any applicable taxes, duties, or governmental charges</li>
              </ul>
              <p style={{ marginBottom: '1rem' }}>
                All fees are charged immediately upon receipt verification or service provision unless otherwise specified. Premium subscription upgrades are billed immediately and prorated for the current billing period. You agree to maintain valid payment information at all times.
              </p>

              <h3 style={{ color: colors.primary, marginBottom: '1rem', fontSize: '1rem' }}>
                3. Subscription & Plan Changes
              </h3>
              <p style={{ marginBottom: '1rem' }}>
                Subscription fees are non-refundable. Plan upgrades take effect immediately with prorated billing. Plan downgrades take effect at the end of the current billing period. You may cancel your subscription at any time, effective at the end of the current billing period. Upon cancellation or downgrade, you forfeit access to premium features but remain liable for all outstanding fees.
              </p>

              <h3 style={{ color: colors.primary, marginBottom: '1rem', fontSize: '1rem' }}>
                4. Receipt Verification & Disputes
              </h3>
              <p style={{ marginBottom: '1rem' }}>
                You agree to review and approve/reject customer receipt submissions within 48 hours. Failure to respond within this timeframe may result in automatic approval. You acknowledge that fraudulent receipt submissions or intentional misrepresentation constitutes grounds for immediate account suspension and forfeiture of all pending payouts. You are solely responsible for verifying the authenticity of transactions. LetsGo is not liable for fraudulent submissions, chargebacks, or disputes arising from your failure to properly verify receipts.
              </p>

              <h3 style={{ color: colors.primary, marginBottom: '1rem', fontSize: '1rem' }}>
                5. Business Information Accuracy
              </h3>
              <p style={{ marginBottom: '1rem' }}>
                You represent and warrant that all business information provided is accurate, current, and complete. You agree to promptly update your profile with any changes to business hours, contact information, services offered, or other material details. Failure to maintain accurate information may result in customer complaints, poor reviews, or account suspension.
              </p>

              <h3 style={{ color: colors.primary, marginBottom: '1rem', fontSize: '1rem' }}>
                6. Content & Media Ownership
              </h3>
              <p style={{ marginBottom: '1rem' }}>
                You retain all rights to content you upload (photos, videos, descriptions). However, you grant LetsGo a worldwide, non-exclusive, royalty-free license to use, display, reproduce, and distribute your content on the LetsGo platform and in marketing materials. You represent that you have all necessary rights to the content and that it does not infringe third-party intellectual property rights. You agree not to upload content that is illegal, offensive, defamatory, or violates our Content Policy.
              </p>

              <h3 style={{ color: colors.primary, marginBottom: '1rem', fontSize: '1rem' }}>
                7. Limitation of Liability
              </h3>
              <p style={{ marginBottom: '1rem' }}>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, LETSGO SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM: (a) YOUR USE OR INABILITY TO USE THE SERVICE; (b) ANY UNAUTHORIZED ACCESS TO OR USE OF YOUR DATA; (c) ANY INTERRUPTION OR CESSATION OF THE SERVICE; (d) ANY BUGS, VIRUSES, OR THE LIKE; (e) ANY ERRORS OR OMISSIONS IN ANY CONTENT; OR (f) ANY LOSS OR DAMAGE ARISING FROM FRAUDULENT TRANSACTIONS OR RECEIPT DISPUTES.
              </p>

              <h3 style={{ color: colors.primary, marginBottom: '1rem', fontSize: '1rem' }}>
                8. Indemnification
              </h3>
              <p style={{ marginBottom: '1rem' }}>
                You agree to indemnify, defend, and hold harmless LetsGo, its officers, directors, employees, agents, and affiliates from and against any and all claims, damages, obligations, losses, liabilities, costs, and expenses (including attorney's fees) arising from: (a) your use of the service; (b) your violation of these terms; (c) your violation of any third-party rights; (d) any content you provide; (e) any fraudulent transactions or receipt disputes; or (f) your business operations or customer interactions.
              </p>

              <h3 style={{ color: colors.primary, marginBottom: '1rem', fontSize: '1rem' }}>
                9. Term & Termination
              </h3>
              <p style={{ marginBottom: '1rem' }}>
                This agreement remains in effect until terminated by either party. LetsGo may suspend or terminate your account immediately, without prior notice or liability, for any reason, including breach of these terms. Upon termination, your right to use the service ceases immediately, but all provisions that by their nature should survive termination shall survive, including payment obligations, indemnification, limitation of liability, and dispute resolution.
              </p>

              <h3 style={{ color: colors.primary, marginBottom: '1rem', fontSize: '1rem' }}>
                10. Dispute Resolution & Governing Law
              </h3>
              <p style={{ marginBottom: '1rem' }}>
                This agreement shall be governed by and construed in accordance with the laws of [Your State/Jurisdiction], without regard to conflict of law principles. Any dispute arising from this agreement shall be resolved through binding arbitration in accordance with the Commercial Arbitration Rules of the American Arbitration Association. You waive your right to a jury trial and to participate in class action lawsuits.
              </p>

              <h3 style={{ color: colors.primary, marginBottom: '1rem', fontSize: '1rem' }}>
                11. Modification of Terms
              </h3>
              <p style={{ marginBottom: '1rem' }}>
                LetsGo reserves the right to modify these terms at any time. We will notify you of material changes via email or through the platform. Continued use of the service after such modifications constitutes acceptance of the updated terms. If you do not agree to the modifications, you must discontinue use of the service.
              </p>

              <h3 style={{ color: colors.primary, marginBottom: '1rem', fontSize: '1rem' }}>
                12. Data Protection & Privacy
              </h3>
              <p style={{ marginBottom: '1rem' }}>
                You acknowledge and agree that LetsGo collects, processes, and stores business and customer data in accordance with our Privacy Policy and applicable data protection laws, including but not limited to GDPR, CCPA, and other regional privacy regulations. You are responsible for obtaining any necessary consents from your customers before their data is shared with LetsGo through receipt submissions. You agree to comply with all applicable privacy and data protection laws in your jurisdiction.
              </p>

              <h3 style={{ color: colors.primary, marginBottom: '1rem', fontSize: '1rem' }}>
                13. Events & Promotions
              </h3>
              <p style={{ marginBottom: '1rem' }}>
                Events created through the LetsGo platform are solely your responsibility. You are liable for all aspects of event execution, including but not limited to: venue safety, capacity compliance, age restrictions, alcohol service laws, accessibility requirements, and any permits or licenses required. LetsGo is not responsible for event cancellations, attendee disputes, injuries, or any claims arising from events you create or host. RSVP counts are estimates only and do not constitute binding reservations unless you implement additional confirmation systems.
              </p>

              <h3 style={{ color: colors.primary, marginBottom: '1rem', fontSize: '1rem' }}>
                14. Advertising & Promotional Campaigns
              </h3>
              <p style={{ marginBottom: '1rem' }}>
                Advertising campaign performance (clicks, conversions, impressions) is provided as estimates only. LetsGo does not guarantee any specific results, return on investment, or customer acquisition numbers. Campaign fees are non-refundable once the campaign start date has passed or within 24 hours of the scheduled start date. You are solely responsible for ensuring your advertising content complies with all applicable advertising laws, FTC guidelines, and does not contain false or misleading claims. LetsGo reserves the right to reject or remove any advertising content at its sole discretion.
              </p>

              <h3 style={{ color: colors.primary, marginBottom: '1rem', fontSize: '1rem' }}>
                15. Fee Schedule Acknowledgment
              </h3>
              <p style={{ marginBottom: '0.5rem' }}>
                You acknowledge and agree to the following fee structure:
              </p>
              <ul style={{ marginBottom: '1rem', paddingLeft: '1.5rem' }}>
                <li><strong>Basic Plan:</strong> LetsGo Fee (10% of subtotal or $5, whichever is less) + Progressive Payout Fee (3-10% based on customer level) + Credit Card Fee (3.5% if applicable)</li>
                <li><strong>Premium Plan:</strong> $100/month subscription + Progressive Payout Fee (3-10% based on customer level) + Credit Card Fee (3.5% if applicable)</li>
                <li><strong>Add-ons:</strong> As selected and priced at time of purchase</li>
                <li><strong>Advertising:</strong> As selected and priced at time of purchase</li>
                <li><strong>TPMS Service:</strong> $200/month if elected</li>
              </ul>
              <p style={{ marginBottom: '1rem' }}>
                Fees are subject to change with 30 days notice. Continued use of the service after fee changes constitutes acceptance of the new fee structure.
              </p>

              <h3 style={{ color: colors.primary, marginBottom: '1rem', fontSize: '1rem' }}>
                16. Modification of Terms
              </h3>
              <p style={{ marginBottom: '1rem' }}>
                LetsGo reserves the right to modify these terms at any time. We will notify you of material changes via email or through the platform. Continued use of the service after such modifications constitutes acceptance of the updated terms. If you do not agree to the modifications, you must discontinue use of the service.
              </p>

              <h3 style={{ color: colors.primary, marginBottom: '1rem', fontSize: '1rem' }}>
                17. Entire Agreement
              </h3>
              <p style={{ marginBottom: '0' }}>
                This agreement, together with our Privacy Policy, Business Billing Policy, and other referenced policies, constitutes the entire agreement between you and LetsGo regarding use of the service and supersedes all prior agreements, understandings, and representations. No waiver of any term shall be deemed a further or continuing waiver of such term or any other term.
              </p>
            </div>

            {/* Confirmation Checkbox */}
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1.5rem'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                lineHeight: '1.5'
              }}>
                <input
                  type="checkbox"
                  style={{
                    width: '18px',
                    height: '18px',
                    marginTop: '0.125rem',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                />
                <span>
                  I acknowledge that I have read, understood, and agree to be legally bound by these Terms & Conditions (Last Updated: January 2, 2026). I authorize LetsGo to charge my designated payment method according to the fee schedule outlined above, including subscription fees, progressive payout fees, credit card processing fees, advertising fees, and any applicable add-on service fees. I understand and accept full responsibility for all events I create and advertising content I submit. I acknowledge this is a legally binding agreement enforceable by law.
                </span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => setShowLegalDisclaimerModal(false)}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Here you would actually publish the changes
                  setShowLegalDisclaimerModal(false);
                  // Show success message or redirect
                }}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.accent} 100%)`,
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: `0 4px 20px ${colors.primary}60`
                }}
              >
                Confirm & Publish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ad Campaign Date Selection Modal */}
{showAdDateModal && selectedAdCampaign && (
  <div
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '2rem',
    }}
    onClick={() => setShowAdDateModal(false)}
  >
    <div
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        padding: '2rem',
        maxWidth: '500px',
        width: '100%',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem' }}>
        Schedule {selectedAdCampaign.name}
      </div>

      <div
        style={{
          fontSize: '2rem',
          fontWeight: '800',
          fontFamily: '"Space Mono", monospace',
          color: selectedAdCampaign.color,
          marginBottom: '1.5rem',
        }}
      >
        {selectedAdCampaign.price}
      </div>

      <div style={{ display: 'grid', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Start Date - Always shown */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              marginBottom: '0.5rem',
              color: 'rgba(255, 255, 255, 0.7)',
            }}
          >
            {selectedAdCampaign.name === '1-Day Spotlight' ? 'Campaign Date' : 'Campaign Start Date'}
          </label>
          <input
            type="date"
            min={new Date().toISOString().split('T')[0]}
            style={{
              width: '100%',
              padding: '0.875rem',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: 'white',
              fontSize: '0.875rem',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* End Date - Only for multi-day campaigns */}
        {selectedAdCampaign.name !== '1-Day Spotlight' && (
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                marginBottom: '0.5rem',
                color: 'rgba(255, 255, 255, 0.7)',
              }}
            >
              Campaign End Date
            </label>
            <input
              type="date"
              min={new Date().toISOString().split('T')[0]}
              style={{
                width: '100%',
                padding: '0.875rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: 'white',
                fontSize: '0.875rem',
                fontFamily: 'inherit',
              }}
            />
            <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '0.5rem' }}>
              {selectedAdCampaign.name === '7-Day Spotlight' && 'Campaign runs for 7 consecutive days from start date'}
              {selectedAdCampaign.name === '14-Day Spotlight' && 'Campaign runs for 14 consecutive days from start date'}
              {selectedAdCampaign.name === '100 Mile Wide Push' && 'Campaign runs for 7 consecutive days with push notifications'}
              {selectedAdCampaign.name === 'Tour Wide Push' && 'Campaign runs for 14 days total (can be split within 60-day range)'}
            </div>
          </div>
        )}
      </div>

      {/* Campaign Summary */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div
          style={{
            fontSize: '0.875rem',
            fontWeight: '600',
            marginBottom: '0.75rem',
            color: selectedAdCampaign.color,
          }}
        >
          Campaign Summary
        </div>
        <div style={{ fontSize: '0.875rem', lineHeight: '1.6', color: 'rgba(255, 255, 255, 0.7)' }}>
          {selectedAdCampaign.description}
        </div>
      </div>

      {/* Cancellation Policy */}
      <div
        style={{
          background: 'rgba(249, 115, 22, 0.1)',
          border: '1px solid rgba(249, 115, 22, 0.3)',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ fontSize: '0.875rem', lineHeight: '1.6', color: 'rgba(255, 255, 255, 0.8)' }}>
          <strong>Cancellation Policy:</strong> You can cancel this campaign up to 24 hours before the start date for a full
          refund. Cancellations within 24 hours of the start date are non-refundable.
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <button
          onClick={() => setShowAdDateModal(false)}
          style={{
            flex: 1,
            padding: '0.875rem',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            color: 'white',
            fontSize: '0.875rem',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>

        <button
          onClick={() => {
            // Here you would process the campaign purchase
            setShowAdDateModal(false);
            // Show success message
          }}
          style={{
            flex: 1,
            padding: '0.875rem',
            background: `linear-gradient(135deg, ${selectedAdCampaign.color} 0%, ${selectedAdCampaign.color}CC 100%)`,
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            fontSize: '0.875rem',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: `0 4px 20px ${selectedAdCampaign.color}60`,
          }}
        >
          Confirm Purchase
        </button>
      </div>
    </div>
  </div>
)}

</div>
);
}
