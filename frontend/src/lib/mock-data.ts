export type Status = "Shortlisted" | "Pending" | "Rejected";

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  experience: number;
  education: string;
  score: number;
  status: Status;
  lastUpdated: string;
  avatar: string;
  summary: string;
  skills: string[];
  missingSkills: string[];
  strengths: string[];
  weaknesses: string[];
  recommendation: "Hire" | "Maybe" | "Reject";
  reasoning: string;
  workHistory: { company: string; role: string; period: string; description: string }[];
  projects: { name: string; description: string }[];
  certifications: string[];
  timeline: { date: string; event: string }[];
}

const firstNames = ["John", "Sarah", "Emily", "Michael", "Priya", "Rahul", "Aisha", "David", "Olivia", "Liam", "Sophia", "Noah", "Ananya", "Ethan", "Isabella", "James"];
const lastNames = ["Anderson", "Williams", "Davis", "Brown", "Sharma", "Patel", "Khan", "Miller", "Wilson", "Garcia", "Chen", "Kumar", "Singh", "Martinez", "Taylor"];
const positions = ["Senior Frontend Engineer", "Backend Engineer", "Full-Stack Engineer", "Data Scientist", "ML Engineer", "Product Designer", "DevOps Engineer", "Mobile Engineer", "Engineering Manager"];
const companies = ["Google", "Microsoft", "Amazon", "Infosys", "TCS", "Accenture", "Meta", "Netflix", "Stripe", "Airbnb"];
const skillsPool = ["React", "TypeScript", "Node.js", "Python", "Go", "AWS", "Kubernetes", "Docker", "GraphQL", "PostgreSQL", "Redis", "Kafka", "Tailwind", "Next.js", "Rust", "Java", "TensorFlow", "PyTorch", "Figma", "System Design"];
const educationList = ["B.Tech Computer Science", "M.S. Computer Science", "B.S. Software Engineering", "Ph.D. Machine Learning", "MBA — Product Management"];
const statuses: Status[] = ["Shortlisted", "Pending", "Rejected"];

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function pickMany<T>(rand: () => number, arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => rand() - 0.5);
  return shuffled.slice(0, n);
}

export const candidates: Candidate[] = Array.from({ length: 24 }).map((_, i) => {
  const rand = seeded(i + 1);
  const first = pick(rand, firstNames);
  const last = pick(rand, lastNames);
  const name = `${first} ${last}`;
  const score = Math.floor(62 + rand() * 36);
  const status: Status = score >= 82 ? "Shortlisted" : score >= 70 ? "Pending" : "Rejected";
  const recommendation = score >= 82 ? "Hire" : score >= 70 ? "Maybe" : "Reject";
  const exp = Math.floor(1 + rand() * 12);
  const skills = pickMany(rand, skillsPool, 6);
  const missing = pickMany(rand, skillsPool.filter(s => !skills.includes(s)), 3);
  const wh = Array.from({ length: 2 + Math.floor(rand() * 2) }).map((__, k) => ({
    company: pick(rand, companies),
    role: pick(rand, positions),
    period: `${2018 + k}-${2020 + k}`,
    description: "Led high-impact initiatives, shipped user-facing features, and mentored engineers on modern web architecture.",
  }));
  return {
    id: `c-${i + 1}`,
    name,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
    phone: `+1 (555) 0${100 + i}-${1000 + i}`,
    position: pick(rand, positions),
    experience: exp,
    education: pick(rand, educationList),
    score,
    status,
    lastUpdated: `${Math.floor(rand() * 6) + 1}h ago`,
    avatar: `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(name)}&backgroundColor=4F46E5,6366F1,7C3AED`,
    summary: `${name} is a ${exp}-year veteran ${status === "Shortlisted" ? "with proven leadership across cross-functional teams" : "with a solid engineering foundation"}, specializing in ${skills.slice(0, 2).join(" & ")}.`,
    skills,
    missingSkills: missing,
    strengths: [
      "Strong system design skills",
      "Excellent communication",
      "Proven leadership on ambiguous problems",
      "Deep expertise in modern web stack",
    ].slice(0, 3),
    weaknesses: [
      "Limited exposure to large-scale distributed systems",
      "No public open-source presence",
      "Gap in recent ML/AI experience",
    ].slice(0, 2),
    recommendation,
    reasoning: `Candidate demonstrates ${score >= 80 ? "outstanding" : score >= 70 ? "solid" : "limited"} alignment with the JD. Skill overlap is ${Math.floor(60 + rand() * 40)}% and experience level fits the seniority band.`,
    workHistory: wh,
    projects: [
      { name: "Realtime Analytics Platform", description: "Built a streaming analytics platform handling 1M events/sec." },
      { name: "Design System Migration", description: "Led migration to a token-driven design system across 40+ apps." },
    ],
    certifications: ["AWS Certified Solutions Architect", "Google Cloud Professional"],
    timeline: [
      { date: "2 days ago", event: "Applied for the role" },
      { date: "1 day ago", event: "Resume parsed by AI" },
      { date: "6h ago", event: `AI recommended: ${recommendation}` },
      { date: "1h ago", event: "Moved to review queue" },
    ],
  };
});

export const stats = {
  total: candidates.length,
  shortlisted: candidates.filter(c => c.status === "Shortlisted").length,
  rejected: candidates.filter(c => c.status === "Rejected").length,
  pending: candidates.filter(c => c.status === "Pending").length,
  avgScore: Math.round(candidates.reduce((a, c) => a + c.score, 0) / candidates.length),
};

export const scoreDistribution = [
  { range: "0-40", count: 2 },
  { range: "41-60", count: 4 },
  { range: "61-70", count: 6 },
  { range: "71-80", count: 8 },
  { range: "81-90", count: 12 },
  { range: "91-100", count: 5 },
];

export const pipelineData = [
  { stage: "Applied", value: 124 },
  { stage: "Screened", value: 86 },
  { stage: "Interview", value: 42 },
  { stage: "Offer", value: 18 },
  { stage: "Hired", value: 9 },
];

export const monthlyApplications = [
  { month: "Jan", apps: 34 },
  { month: "Feb", apps: 42 },
  { month: "Mar", apps: 58 },
  { month: "Apr", apps: 71 },
  { month: "May", apps: 66 },
  { month: "Jun", apps: 88 },
  { month: "Jul", apps: 104 },
  { month: "Aug", apps: 96 },
  { month: "Sep", apps: 121 },
];

export const skillDistribution = [
  { skill: "React", value: 82 },
  { skill: "TypeScript", value: 74 },
  { skill: "Python", value: 61 },
  { skill: "AWS", value: 58 },
  { skill: "Node.js", value: 66 },
  { skill: "SQL", value: 71 },
];

export const missingSkillsData = [
  { skill: "Kubernetes", value: 42 },
  { skill: "Rust", value: 38 },
  { skill: "System Design", value: 33 },
  { skill: "GraphQL", value: 27 },
  { skill: "ML Ops", value: 22 },
];

export const recentActivity = [
  { who: "Sarah Williams", what: "was shortlisted for Senior Frontend Engineer", when: "2m ago", type: "success" as const },
  { who: "AI Engine", what: "finished analyzing 12 new resumes", when: "18m ago", type: "info" as const },
  { who: "Michael Brown", what: "was rejected — score below threshold", when: "45m ago", type: "danger" as const },
  { who: "Emily Davis", what: "moved to interview stage", when: "1h ago", type: "success" as const },
  { who: "New JD", what: "\"Staff Data Scientist\" was published", when: "3h ago", type: "info" as const },
  { who: "Priya Sharma", what: "uploaded an updated resume", when: "5h ago", type: "info" as const },
];
