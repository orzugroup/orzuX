export const ONBOARDING_MESSAGES = {
  pageTitle: "Create your business profile",
  pageDescription:
    "Fill in the required fields to open the dashboard. Extra details below are optional and help OrzuX AI.",
  progressLabel: "Setup progress",
  mandatoryBadge: "Required",
  profileCompleteBadge: "Business profile saved",
  optionalBadge: "Optional",
  stepBusinessTitle: "Business profile",
  stepBusinessDescription:
    "Name, industry sector, description, and business email. OrzuX AI reads this when you have not added a knowledge base yet.",
  optionalFieldsHint: "Optional",
  employeeCountLabel: "Team size",
  stepContinueTitle: "Setup is not finished yet",
  stepContinueDescription:
    "Your profile is saved and the dashboard is open. Finish optional steps when you are ready.",
  stepChannelTitle: "Connect a messaging channel",
  stepChannelDescription:
    "WhatsApp, Telegram, Instagram, email, or website chat — one inbox for all customer messages.",
  stepKnowledgeTitle: "Knowledge base",
  stepKnowledgeDescription:
    "Add FAQs, pricing, and hours so AI replies stay accurate.",
  stepAiTitle: "AI Assistant",
  stepAiDescription: "Turn on auto-replies for your connected channels.",
  stepAiOpenSettings: "Open AI Assistant",
  stepAiCustomize: "Customize assistant",
  stepKnowledgeAdd: "Add knowledge",
  stepFinish: "Go to dashboard",
  goToDashboard: "Go to dashboard",
  backToDashboard: "Back to dashboard",
  back: "Back",
  continue: "Continue setup",
  skipSetup: "Skip for now",
  collapseSetupCard: "Hide",
  expandSetupCard: "Show setup progress",
  checklistTitle: "Setup not finished",
  checklistDescription:
    "Required profile is done. Optional steps help you get more from OrzuX.",
  incompleteSetupBanner:
    "You can work in the dashboard now. These steps are optional — complete them to unlock the full AI experience.",
  openStep: "Open",
  sectorLabel: "Industry / sector",
  sectorPickerClosedHint: "Tap to choose your industry",
  sectorCustomLabel: "Describe your sector",
  sectorCustomPlaceholder: "e.g. Dental clinic, Auto repair",
  typeLabel: "Business type",
  typeCustomLabel: "Describe your business type",
  typeCustomPlaceholder: "e.g. Family-owned workshop",
  businessEmailHint:
    "We send a short confirmation to this address that it was linked as your business email on OrzuX.",
  businessEmailSentToast: "Confirmation email sent",
  aiFallbackHint:
    "Until you add a knowledge base, the AI uses this profile to answer customers.",
  optionalRoadmapHint:
    "Nothing here is required to use OrzuX. You can return from the dashboard anytime.",
  editProfileTitle: "Edit business profile",
  sectionIdentity: "Identity",
  sectionIndustry: "Industry",
  sectionContact: "Contact",
  sectionOptionalDetails: "Optional details",
  submitCreate: "Save business profile",
  submitUpdate: "Save changes",
  optionalStepsRemaining: (count: number) =>
    count === 1
      ? "1 optional step left — finish anytime."
      : `${count} optional steps left — finish anytime.`,
} as const;

export const ONBOARDING_STEPS = [
  { id: "business", label: "Business profile", required: true },
  { id: "channel", label: "Channel", required: false },
  { id: "ai", label: "AI Assistant", required: false },
  { id: "knowledge", label: "Knowledge", required: false },
] as const;
