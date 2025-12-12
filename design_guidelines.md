# Design Guidelines: Healthcare Staffing Agency Landing Page

## Design Approach

**Hybrid Approach**: Drawing inspiration from **LinkedIn** (professional trust signals), **Indeed/ZipRecruiter** (job listing patterns), and **Airbnb** (clean card-based layouts). This creates a professional healthcare aesthetic balanced with functional, efficient interfaces for job browsing and issue reporting.

## Typography System

**Primary Font**: Inter (Google Fonts)
- **Headlines (H1)**: 48px (3rem), font-weight 700, leading tight
- **Subheadlines (H2)**: 36px (2.25rem), font-weight 600
- **Section Headers (H3)**: 24px (1.5rem), font-weight 600
- **Body Large**: 18px (1.125rem), font-weight 400, leading relaxed
- **Body Regular**: 16px (1rem), font-weight 400, leading normal
- **Small Text/Labels**: 14px (0.875rem), font-weight 500

## Layout System

**Spacing Primitives**: Use Tailwind units of **2, 4, 6, 8, 12, 16, 20** for consistent rhythm
- Section vertical padding: py-20 (desktop), py-12 (mobile)
- Component spacing: gap-6 or gap-8 for grids
- Card padding: p-6
- Container max-width: max-w-7xl with px-6 horizontal padding

## Component Library

### Hero Section
- Full-width background with healthcare imagery (medical professionals in action, preferably diverse team)
- Centered content overlay with blurred button backgrounds
- **Content**: Bold headline emphasizing "24/7 Healthcare Staffing", subheadline with value proposition, dual CTAs ("Find Workers" + "Post Jobs")
- Trust indicators below CTAs: "5,000+ Healthcare Professionals" | "24/7 Support" | "Same-Day Placement"
- Height: 80vh minimum

### Services/Features Grid
- 3-column layout (desktop), single column (mobile)
- Icon-title-description cards with subtle borders
- **Services**: Nursing Staff, Medical Assistants, CNAs/Home Health Aides, Specialized Care, Emergency Coverage, Long-term Contracts
- Icons: Use Heroicons (outline style)

### Interactive Job Map Section
- **Layout**: 2-column split - Left: Map (60% width), Right: Job list sidebar (40% width)
- Map implementation: Leaflet.js with custom healthcare-themed markers
- Job markers: Color-coded by urgency (immediate, within 24hrs, scheduled)
- Click marker reveals job popup with facility name, role, shift time, pay rate
- Sidebar: Scrollable list of jobs with filters (role type, location, pay range, shift time)
- Mobile: Stack map above list, both full-width

### Job Listing Cards
- Clean card design with left accent border indicating urgency
- **Content structure**: 
  - Top: Facility name + location badge
  - Middle: Role title (bold), shift details, hourly rate (prominent)
  - Bottom: Requirements tags + "Apply Now" button
- Grid: 2 columns (desktop), 1 column (mobile)

### Issue Reporting Section
- **Layout**: Centered form container (max-w-2xl)
- Ticket form fields:
  - Shift/Job ID (dropdown of user's recent shifts)
  - Issue category (dropdown: Late cancellation, Payment issue, Facility concern, Other)
  - Description (textarea, min 3 rows)
  - Priority level (radio buttons: Low, Medium, High, Urgent)
  - Attachments (file upload, accept images/PDFs)
- Submit button: Full-width, prominent
- Success state: Show ticket number and expected response time

### Trust & Social Proof Section
- Statistics bar: 4 columns with large numbers
  - Healthcare Workers Placed, Facilities Served, Average Response Time, Success Rate
- Testimonial cards: 3-column grid with healthcare worker/facility testimonials
- Include role/facility name, location, star ratings

### Footer
- 4-column layout: Company Info, For Healthcare Workers, For Facilities, Support
- Newsletter signup: "Stay updated on new opportunities"
- License/accreditation badges
- Social links, phone number (prominent), emergency contact line

## Images

**Hero Image**: Professional medical team collaborating in modern facility - diverse, authentic, high-energy. Wide landscape format covering full hero section background with subtle overlay for text readability.

**Supporting Images** (if needed): 
- Healthcare workers in action for testimonial sections
- Facility imagery for credibility building

## Component Specifications

**Buttons**:
- Primary: Solid background, rounded-lg, px-8 py-3, font-weight 600
- Secondary: Outlined variant with border-2
- Hero buttons: Backdrop blur effect (backdrop-blur-sm bg-white/90)

**Cards**: 
- Background: White, rounded-lg, shadow-sm, hover:shadow-md transition
- Borders: Subtle (border border-gray-200)

**Form Inputs**:
- Rounded-md, border-gray-300, px-4 py-2.5
- Focus: Ring-2 with offset
- Labels: font-weight 500, text-sm, mb-2

**Badges/Tags**: 
- Rounded-full, px-3 py-1, text-sm font-medium
- Use for: Shift types, certifications required, urgency levels

**Map Markers**: Custom SVG pins with facility type icons inside, drop shadow for depth

## Accessibility Notes
- Maintain WCAG AA contrast ratios throughout
- Form labels properly associated with inputs
- Map includes keyboard navigation for job markers
- Issue reporting form has clear error states and validation messages

This design balances professional credibility essential for healthcare with modern, user-friendly interfaces for efficient job discovery and issue resolution.