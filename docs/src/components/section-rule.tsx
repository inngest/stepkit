import { Link } from '@tanstack/react-router';
import { HomeLayout } from 'fumadocs-ui/layouts/home';

export function SectionRule({ name, className = "", border = true }) {
  return (
    <div className={`max-w-[1400px] mx-auto my-0 ${className}`}>
      {border ? (

        <div className="relative border-t-[1.5px] border-t-[#242424] py-6">
          <div aria-hidden="true" className="absolute top-[0px] left-0 h-[3px] w-[18%] bg-[#242424]" />
          <Content name={name} />
        </div>
      ) : (
          <Content name={name} />
        )
      }
    </div>
  );
}

const Content = ({ name }) => (
  <p className="uppercase flex items-center gap-2 leading-none relative font-mono">
    <span className="text-xl mt-[-4px] mr-1">■</span>
    {name}
  </p>
)
