import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import {
  BarChart3,
  EyeOff,
  GitMerge,
  LineChart,
  Link2,
  Megaphone,
  Plug,
} from "lucide-react"

import { AnimatedGradient } from "@/components/ui/animated-gradient"
import { Reveal } from "@/components/ui/reveal"
import { AttributNav } from "@/components/attribut/attribut-nav"
import { CashAttributionList } from "@/components/attribut/cash-attribution-list"
import { WaitlistForm } from "@/components/attribut/waitlist-form"
import { Footer } from "@/components/sections/footer"

/**
 * TODO: replace with the real count once the waitlist is wired to a provider.
 * The avatars below are generic stock portraits, not actual members.
 */
const WAITLIST_COUNT = "300+"

const AVATARS = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=faces&auto=format&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=faces&auto=format&q=80",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop&crop=faces&auto=format&q=80",
]

const gaps = [
  {
    icon: Megaphone,
    title: "Ad tools ignore organic.",
    desc: "They were built for paid traffic. Your best performing reel never shows up in the report.",
  },
  {
    icon: EyeOff,
    title: "Link tools are blind to which post.",
    desc: "You get a click count. You still cannot tell which video sent the person who paid you.",
  },
  {
    icon: LineChart,
    title: "Analytics never show revenue.",
    desc: "Views, reach, saves, watch time. None of it tells you what actually got paid.",
  },
]

const steps = [
  {
    icon: Plug,
    title: "Connect IG and YouTube.",
    desc: "Read only access. Takes about a minute.",
  },
  {
    icon: Link2,
    title: "Drop a smart link.",
    desc: "One link in your bio and stories. It tags every visit.",
  },
  {
    icon: GitMerge,
    title: "We stitch the journey.",
    desc: "View to click to call to payment, joined into one thread.",
  },
  {
    icon: BarChart3,
    title: "See cash by content.",
    desc: "Open the dashboard. Sort your posts by revenue.",
  },
]

function GridOverlay() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.055)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_78%)]"
    />
  )
}

export default function Attribut() {
  return (
    <div className="relative bg-[#0a0503]">
      <AttributNav />

      <main>
        {/* Hero */}
        <section
          id="waitlist"
          className="relative flex min-h-screen items-center overflow-hidden px-6 pb-24 pt-32 sm:pt-36"
        >
          {/* Living gradient background */}
          <AnimatedGradient
            config={{
              preset: "custom",
              color1: "#0a0503",
              color2: "#180804",
              color3: "#9e3417",
              speed: 7,
              swirl: 60,
              swirlIterations: 8,
              distortion: 22,
              softness: 100,
              proportion: 32,
              scale: 0.55,
              rotation: 0,
              shape: "Edge",
              shapeSize: 55,
            }}
            noise={{ opacity: 0.15 }}
            className="absolute inset-0"
          />

          <GridOverlay />

          {/* Vignette keeps the edges deep */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(10,5,3,0.25)_20%,rgba(10,5,3,0.82)_70%,#0a0503_100%)]"
          />
          {/* Scrim directly behind the copy so the headline never fights the
              bright part of the gradient */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_45%,rgba(10,5,3,0.62),transparent_70%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-b from-transparent to-[#0a0503]"
          />

          <div className="relative z-10 mx-auto w-full max-w-4xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-flex items-center gap-2.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-ember opacity-60 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ember" />
                </span>
                <span className="text-[12px] uppercase tracking-[0.2em] text-white/55">
                  Now onboarding by invite
                </span>
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.85,
                delay: 0.12,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="mx-auto mt-7 max-w-3xl text-balance font-display text-[40px] font-bold leading-[1.04] tracking-tight text-white sm:text-6xl md:text-[76px]"
            >
              Know exactly which post got you{" "}
              <span className="font-accent text-[1.12em] font-normal italic text-ember-light [text-shadow:0_2px_24px_rgba(10,5,3,0.85)]">
                paid
              </span>
              .
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.28 }}
              className="mx-auto mt-6 max-w-xl text-pretty text-[15px] leading-relaxed text-white/60 sm:text-[17px]"
            >
              Attribut follows the whole organic journey. The reel they watched,
              the link they tapped, the call they booked, the cash they paid.
              One thread, end to end.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.42 }}
              className="mt-10"
            >
              <WaitlistForm id="waitlist-hero" source="attribut_hero" />

              <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <div className="flex -space-x-2.5">
                  {AVATARS.map((src, i) => (
                    <img
                      key={src}
                      src={src}
                      alt=""
                      aria-hidden
                      loading="lazy"
                      width={32}
                      height={32}
                      className="h-8 w-8 rounded-full border-2 border-[#0a0503] object-cover"
                      style={{ zIndex: AVATARS.length - i }}
                    />
                  ))}
                </div>
                <p className="text-[13px] text-white/50">
                  Join {WAITLIST_COUNT} coaches and creators on the list.
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Living proof */}
        <section className="relative overflow-hidden px-6 py-24 sm:py-28">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/3 h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(242,84,45,0.13),transparent_68%)] blur-3xl motion-safe:animate-ember-pulse"
          />

          <div className="relative mx-auto max-w-5xl">
            <Reveal className="mx-auto max-w-xl text-center">
              <p className="text-[13px] font-medium uppercase tracking-[0.2em] text-ember">
                Living proof
              </p>
              <h2 className="mt-4 text-balance font-display text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
                Watch the money find the post.
              </h2>
              <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-white/55">
                Every sale traced back to the exact piece of content that
                produced it.
              </p>
            </Reveal>

            <Reveal delay={0.12} className="mt-12">
              <CashAttributionList />
            </Reveal>

            <p className="mt-2 text-center text-[12px] text-white/35">
              Every number on this page is illustrative.
            </p>
          </div>
        </section>

        {/* The gap */}
        <section className="relative px-6 py-24 sm:py-28">
          <div className="mx-auto max-w-5xl">
            <Reveal className="mx-auto max-w-xl text-center">
              <p className="text-[13px] font-medium uppercase tracking-[0.2em] text-ember">
                The gap
              </p>
              <h2 className="mt-4 text-balance font-display text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
                Nothing you own can answer this.
              </h2>
            </Reveal>

            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              {gaps.map((gap, i) => (
                <Reveal key={gap.title} delay={i * 0.1}>
                  <div className="group h-full rounded-2xl border border-white/10 bg-white/[0.035] p-6 backdrop-blur-md transition-colors duration-300 hover:border-ember/25">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-ember/25 bg-ember/10 text-ember-light">
                      <gap.icon className="h-[18px] w-[18px]" />
                    </span>
                    <h3 className="mt-5 font-display text-[17px] font-semibold tracking-tight text-white">
                      {gap.title}
                    </h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-white/55">
                      {gap.desc}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="relative px-6 py-24 sm:py-28">
          <div className="mx-auto max-w-5xl">
            <Reveal className="mx-auto max-w-xl text-center">
              <p className="text-[13px] font-medium uppercase tracking-[0.2em] text-ember">
                How it works
              </p>
              <h2 className="mt-4 text-balance font-display text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
                Four steps to revenue by post.
              </h2>
            </Reveal>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, i) => (
                <Reveal key={step.title} delay={i * 0.08}>
                  <div className="relative h-full rounded-2xl border border-white/10 bg-white/[0.035] p-6 backdrop-blur-md">
                    <div className="flex items-center justify-between">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-ember/25 bg-ember/10 text-ember-light">
                        <step.icon className="h-[18px] w-[18px]" />
                      </span>
                      <span className="font-display text-[13px] font-medium tabular-nums text-white/25">
                        0{i + 1}
                      </span>
                    </div>
                    <h3 className="mt-5 font-display text-[16px] font-semibold tracking-tight text-white">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-white/55">
                      {step.desc}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative px-6 pb-24 pt-8 sm:pb-32">
          <div className="mx-auto max-w-4xl">
            <Reveal>
              <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.04] px-6 py-16 text-center backdrop-blur-xl sm:px-14 sm:py-20">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 -top-1/2 h-[520px] bg-[radial-gradient(ellipse_at_top,rgba(242,84,45,0.24),transparent_62%)]"
                />
                <GridOverlay />

                <div className="relative">
                  <span className="inline-flex items-center gap-2.5 rounded-full border border-ember/25 bg-ember/10 py-1.5 pl-3.5 pr-4 text-[12.5px] text-ember-light">
                    <span className="h-1.5 w-1.5 rounded-full bg-ember" />
                    Invite only
                  </span>

                  <h2 className="mx-auto mt-6 max-w-2xl text-balance font-display text-3xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl">
                    Stop guessing which post{" "}
                    <span className="font-accent text-[1.1em] font-normal italic text-ember">
                      actually
                    </span>{" "}
                    works.
                  </h2>

                  <div className="mt-9">
                    <WaitlistForm
                      id="waitlist-final"
                      source="attribut_final_cta"
                      buttonLabel="Join waitlist"
                    />
                  </div>

                  <p className="mt-6 text-[13px] text-white/45">
                    We open seats in small batches.
                  </p>

                  <p className="mt-2 text-[12px] text-white/35">
                    By joining you agree to our{" "}
                    <Link
                      to="/attribut/terms"
                      className="text-white/60 underline underline-offset-2 transition-colors hover:text-ember-light"
                    >
                      Terms
                    </Link>{" "}
                    and{" "}
                    <Link
                      to="/attribut/privacy"
                      className="text-white/60 underline underline-offset-2 transition-colors hover:text-ember-light"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </p>
                </div>
              </div>
            </Reveal>

            {/* Legal links */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-white/40">
              <Link
                to="/attribut/terms"
                className="transition-colors hover:text-white"
              >
                Terms and Conditions
              </Link>
              <Link
                to="/attribut/privacy"
                className="transition-colors hover:text-white"
              >
                Privacy Policy
              </Link>
              <span className="text-white/25">
                Attribut is a product by Clientsforge.
              </span>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
