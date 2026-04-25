export type RecruiterChallengeConfig = {
  active: boolean;
  startDate: string;
  endDate: string;
  deadlineLabel: string;
  bountyBasic: number;
  bountyPremium: number;
  bonusPrize: number;
  signupUrl: string;
  brochureUrl: string;
  imageUrl: string;
  elevatorPitch: string;
};

export const recruiterChallenge: RecruiterChallengeConfig = {
  active: true,
  startDate: "2026-04-24",
  endDate: "2026-08-31",
  deadlineLabel: "Challenge ends August 31, 2026 · 11:59pm CT",
  bountyBasic: 100,
  bountyPremium: 250,
  bonusPrize: 1000,
  signupUrl: "https://www.useletsgo.com/welcome",
  brochureUrl: "https://www.useletsgo.com/brochure-business.html",
  imageUrl: "/progressive-payout-locked.png",
  elevatorPitch:
    "Hey — there's a new local app called LetsGo. It sends verified customers to your business and you only pay when someone actually walks in and spends money. No monthly fee on the basic plan. It's literally zero risk. Worth 2 minutes of your time — I can send you the brochure?",
};

export function isChallengeLive(now: Date = new Date()): boolean {
  if (!recruiterChallenge.active) return false;
  const today = now.toISOString().slice(0, 10);
  return today >= recruiterChallenge.startDate && today <= recruiterChallenge.endDate;
}
