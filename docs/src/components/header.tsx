import { Link } from "@tanstack/react-router"
import { Github } from "lucide-react"

interface NavItem {
  label: string
  href: string
}

interface HeaderProps {
  activeItem?: string
}

export function Header({ activeItem }: HeaderProps) {
  return (
    <nav class="w-full pt-6 uppercase tracking-normal font-mono">
      <div class="grid grid-cols-22 gap-4 items-stretch">
        <Link to="/" className="h-full flex items-center justify-start space-x-2 border-t-4 border-white pt-2 col-span-7 hover:opacity-70">
          <img src="/logos/stepkit-logo.svg" alt="StepKit" className="h-8 w-auto" />
        </Link>

        <a href="/docs" class="h-full border-t-4 border-white pt-2 flex items-center justify-start text-left space-x-2 col-span-7 hover:opacity-70">
          <svg class="w-2 h-2 fill-white" viewBox="0 0 10 10"><rect width="10" height="10" /></svg>
          <span>Docs</span>
        </a>

        <a href="/docs/learn/examples/ai-rag-workflow" class="h-full border-t-4 border-white pt-2 flex items-center justify-start text-left space-x-2 col-span-7 hover:opacity-70">
          <svg class="w-2 h-2 fill-white" viewBox="0 0 10 10"><rect width="10" height="10" /></svg>
          <span>Examples</span>
        </a>

        {/*
      <a href="#" class="h-full border-t-4 border-white pt-2 flex items-center justify-end text-right space-x-2 hover:opacity-70">
        <svg class="w-2 h-2 fill-white" viewBox="0 0 10 10"><rect width="10" height="10" /></svg>
        <span>Blog</span>
      </a>

      <a href="#" class="h-full border-t-4 border-white pt-2 flex items-center justify-end text-right space-x-2 hover:opacity-70">
        <svg class="w-2 h-2 fill-white" viewBox="0 0 10 10"><rect width="10" height="10" /></svg>
        <span>About</span>
      </a>
      */}

        <div class="h-full hidden sm:flex items-start justify-end space-x-2 col-span-1">
          {/*<a href="#" class="px-2 py-1 border border-white text-[9px] md:text-[10px] tracking-normal hover:bg-white hover:text-black">STEP_RUN-LATEST</a>*/}
          <a href="https://www.github.com/inngest/stepkit" class="w-6 h-6 flex items-center justify-end text-right h-[36px] w-[36px]">
            <GithubIcon />
          </a>
        </div>
      </div>
    </nav>
  )
}

const GithubIcon = () => (
  <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="36" height="36" fill="white" />
    <path fill-rule="evenodd" clip-rule="evenodd" d="M18.5103 6C11.5924 6 6 11.5 6 18.3042C6 23.7432 9.58327 28.3472 14.5542 29.9767C15.1757 30.0991 15.4034 29.7119 15.4034 29.3862C15.4034 29.1009 15.3829 28.1232 15.3829 27.1044C11.9028 27.8379 11.1781 25.6377 11.1781 25.6377C10.6188 24.2117 9.79018 23.8452 9.79018 23.8452C8.65116 23.0914 9.87315 23.0914 9.87315 23.0914C11.1366 23.1729 11.7996 24.3544 11.7996 24.3544C12.9179 26.2284 14.7199 25.6989 15.4449 25.3729C15.5483 24.5784 15.8799 24.0284 16.232 23.7229C13.4564 23.4377 10.5361 22.3784 10.5361 17.6522C10.5361 16.3077 11.0329 15.2077 11.8201 14.3522C11.6959 14.0467 11.2608 12.7835 11.9446 11.0927C11.9446 11.0927 13.0009 10.7667 15.3826 12.3557C16.4023 12.0864 17.454 11.9494 18.5103 11.9482C19.5667 11.9482 20.6435 12.091 21.6378 12.3557C24.0198 10.7667 25.0761 11.0927 25.0761 11.0927C25.7599 12.7835 25.3245 14.0467 25.2003 14.3522C26.0083 15.2077 26.4846 16.3077 26.4846 17.6522C26.4846 22.3784 23.5643 23.4172 20.7679 23.7229C21.2237 24.1099 21.6171 24.8432 21.6171 26.0044C21.6171 27.6544 21.5966 28.9787 21.5966 29.3859C21.5966 29.7119 21.8245 30.0991 22.4457 29.9769C27.4167 28.3469 30.9999 23.7432 30.9999 18.3042C31.0204 11.5 25.4075 6 18.5103 6Z" fill="#242424" />
  </svg>

)
