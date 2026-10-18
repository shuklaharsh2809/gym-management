/**
 * The app's icon vocabulary, backed by Phosphor Icons (MIT). Import icons from here, never from an
 * icon package directly, so the set stays consistent and can be swapped in one place.
 *
 * Semantic icons (navigation, stats, empty states) use the duotone weight; small controls
 * (chevrons, close, add) use bold so they stay crisp at 16px. Pass `weight` to override.
 * The SSR build works in both Server and Client Components.
 */
import type { Icon as PhosphorIcon, IconProps, IconWeight } from "@phosphor-icons/react";
import {
  AirplaneTilt as PhAirplaneTilt,
  Alarm as PhAlarm,
  ArrowClockwise as PhArrowClockwise,
  ArrowSquareOut as PhArrowSquareOut,
  Barbell as PhBarbell,
  Bell as PhBell,
  Buildings as PhBuildings,
  Calendar as PhCalendar,
  CalendarBlank as PhCalendarBlank,
  CalendarCheck as PhCalendarCheck,
  CalendarDots as PhCalendarDots,
  CaretDown as PhCaretDown,
  CaretLeft as PhCaretLeft,
  CaretRight as PhCaretRight,
  CaretUpDown as PhCaretUpDown,
  ChartBar as PhChartBar,
  Check as PhCheck,
  CheckCircle as PhCheckCircle,
  CircleNotch as PhCircleNotch,
  ClipboardText as PhClipboardText,
  Clock as PhClock,
  ClockCounterClockwise as PhClockCounterClockwise,
  Coins as PhCoins,
  Copy as PhCopy,
  CreditCard as PhCreditCard,
  Cube as PhCube,
  DownloadSimple as PhDownloadSimple,
  EnvelopeSimple as PhEnvelopeSimple,
  FileText as PhFileText,
  Flask as PhFlask,
  Gear as PhGear,
  GearSix as PhGearSix,
  HandCoins as PhHandCoins,
  HourglassMedium as PhHourglassMedium,
  Info as PhInfo,
  Invoice as PhInvoice,
  List as PhList,
  Lock as PhLock,
  MagnifyingGlass as PhMagnifyingGlass,
  MagnifyingGlassMinus as PhMagnifyingGlassMinus,
  MapPin as PhMapPin,
  Minus as PhMinus,
  Package as PhPackage,
  PencilSimple as PhPencilSimple,
  PhoneCall as PhPhoneCall,
  Plug as PhPlug,
  Plus as PhPlus,
  Printer as PhPrinter,
  Receipt as PhReceipt,
  Repeat as PhRepeat,
  Scan as PhScan,
  ShieldCheck as PhShieldCheck,
  ShoppingBag as PhShoppingBag,
  ShoppingCart as PhShoppingCart,
  SidebarSimple as PhSidebarSimple,
  SignOut as PhSignOut,
  Smiley as PhSmiley,
  SquaresFour as PhSquaresFour,
  Tag as PhTag,
  Target as PhTarget,
  Trash as PhTrash,
  Truck as PhTruck,
  UploadSimple as PhUploadSimple,
  UserGear as PhUserGear,
  UserPlus as PhUserPlus,
  Users as PhUsers,
  UsersThree as PhUsersThree,
  Wallet as PhWallet,
  Warning as PhWarning,
  WarningCircle as PhWarningCircle,
  Wrench as PhWrench,
  X as PhX,
  XCircle as PhXCircle,
} from "@phosphor-icons/react/dist/ssr";

export type AppIcon = (props: IconProps) => React.JSX.Element;

function icon(Base: PhosphorIcon, weight: IconWeight, name: string): AppIcon {
  // 24px matches the previous icon set; Tailwind size classes override it.
  const Component = (props: IconProps) => <Base size={24} weight={weight} {...props} />;
  Component.displayName = name;
  return Component;
}

export const AlarmClock = icon(PhAlarm, "duotone", "AlarmClock");
export const AlertCircle = icon(PhWarningCircle, "duotone", "AlertCircle");
export const AlertTriangle = icon(PhWarning, "duotone", "AlertTriangle");
export const BarChart3 = icon(PhChartBar, "duotone", "BarChart3");
export const Bell = icon(PhBell, "duotone", "Bell");
export const Boxes = icon(PhCube, "duotone", "Boxes");
export const Building2 = icon(PhBuildings, "duotone", "Building2");
export const CalendarCheck = icon(PhCalendarCheck, "duotone", "CalendarCheck");
export const CalendarClock = icon(PhCalendarDots, "duotone", "CalendarClock");
export const CalendarDays = icon(PhCalendarBlank, "duotone", "CalendarDays");
export const CalendarRange = icon(PhCalendar, "duotone", "CalendarRange");
export const Check = icon(PhCheck, "bold", "Check");
export const CheckCircle2 = icon(PhCheckCircle, "duotone", "CheckCircle2");
export const ChevronDown = icon(PhCaretDown, "bold", "ChevronDown");
export const ChevronLeft = icon(PhCaretLeft, "bold", "ChevronLeft");
export const ChevronRight = icon(PhCaretRight, "bold", "ChevronRight");
export const ChevronsUpDown = icon(PhCaretUpDown, "bold", "ChevronsUpDown");
export const CircleDollarSign = icon(PhCoins, "duotone", "CircleDollarSign");
export const ClipboardList = icon(PhClipboardText, "duotone", "ClipboardList");
export const Clock = icon(PhClock, "duotone", "Clock");
export const Cog = icon(PhGear, "duotone", "Cog");
export const Copy = icon(PhCopy, "bold", "Copy");
export const CreditCard = icon(PhCreditCard, "duotone", "CreditCard");
export const Download = icon(PhDownloadSimple, "bold", "Download");
export const Dumbbell = icon(PhBarbell, "duotone", "Dumbbell");
export const ExternalLink = icon(PhArrowSquareOut, "bold", "ExternalLink");
export const FileText = icon(PhFileText, "duotone", "FileText");
export const FlaskConical = icon(PhFlask, "duotone", "FlaskConical");
export const HandCoins = icon(PhHandCoins, "duotone", "HandCoins");
export const History = icon(PhClockCounterClockwise, "duotone", "History");
export const Hourglass = icon(PhHourglassMedium, "duotone", "Hourglass");
export const Info = icon(PhInfo, "duotone", "Info");
export const LayoutDashboard = icon(PhSquaresFour, "duotone", "LayoutDashboard");
export const Loader2 = icon(PhCircleNotch, "bold", "Loader2");
export const Lock = icon(PhLock, "duotone", "Lock");
export const LogOut = icon(PhSignOut, "bold", "LogOut");
export const MailWarning = icon(PhEnvelopeSimple, "duotone", "MailWarning");
export const MapPin = icon(PhMapPin, "duotone", "MapPin");
export const Menu = icon(PhList, "bold", "Menu");
export const Minus = icon(PhMinus, "bold", "Minus");
export const Package = icon(PhPackage, "duotone", "Package");
export const PanelLeftClose = icon(PhSidebarSimple, "bold", "PanelLeftClose");
export const PanelLeftOpen = icon(PhSidebarSimple, "bold", "PanelLeftOpen");
export const Pencil = icon(PhPencilSimple, "bold", "Pencil");
export const PhoneCall = icon(PhPhoneCall, "duotone", "PhoneCall");
export const Plane = icon(PhAirplaneTilt, "duotone", "Plane");
export const Plug = icon(PhPlug, "duotone", "Plug");
export const Plus = icon(PhPlus, "bold", "Plus");
export const Printer = icon(PhPrinter, "bold", "Printer");
export const Receipt = icon(PhReceipt, "duotone", "Receipt");
export const ReceiptText = icon(PhInvoice, "duotone", "ReceiptText");
export const Repeat = icon(PhRepeat, "duotone", "Repeat");
export const RotateCw = icon(PhArrowClockwise, "bold", "RotateCw");
export const ScanLine = icon(PhScan, "duotone", "ScanLine");
export const Search = icon(PhMagnifyingGlass, "bold", "Search");
export const SearchX = icon(PhMagnifyingGlassMinus, "duotone", "SearchX");
export const Settings = icon(PhGearSix, "duotone", "Settings");
export const ShieldCheck = icon(PhShieldCheck, "duotone", "ShieldCheck");
export const ShoppingBag = icon(PhShoppingBag, "duotone", "ShoppingBag");
export const ShoppingCart = icon(PhShoppingCart, "duotone", "ShoppingCart");
export const Smile = icon(PhSmiley, "duotone", "Smile");
export const Tags = icon(PhTag, "duotone", "Tags");
export const Target = icon(PhTarget, "duotone", "Target");
export const Trash2 = icon(PhTrash, "bold", "Trash2");
export const TriangleAlert = icon(PhWarning, "duotone", "TriangleAlert");
export const Truck = icon(PhTruck, "duotone", "Truck");
export const Upload = icon(PhUploadSimple, "bold", "Upload");
export const UserCog = icon(PhUserGear, "duotone", "UserCog");
export const UserPlus = icon(PhUserPlus, "duotone", "UserPlus");
export const Users = icon(PhUsers, "duotone", "Users");
export const UsersRound = icon(PhUsersThree, "duotone", "UsersRound");
export const Wallet = icon(PhWallet, "duotone", "Wallet");
export const Wrench = icon(PhWrench, "duotone", "Wrench");
export const X = icon(PhX, "bold", "X");
export const XCircle = icon(PhXCircle, "duotone", "XCircle");
