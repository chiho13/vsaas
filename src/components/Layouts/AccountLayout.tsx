import Link from "next/link";
import styled from "styled-components";
import Dropdown from "../Dropdown";
import Head from "next/head";

import { useRef } from "react";
import { AccountLayoutStyle } from "./style";

import ChevronDown from "@/icons/ChevronDown";
import { LogoutIcon } from "@/icons/Logout";
import { useSupabaseClient } from "@supabase/auth-helpers-react";

const Header = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  color: ${({ theme }) => theme.colors.brand};
`;

const Navbar = styled.nav`
  display: flex;
  gap: 1rem;
`;

const NavLink = styled.a`
  font-weight: bold;
  color: ${({ theme }) => theme.colors.brand};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

interface LayoutProps {
  children: React.ReactNode;
  profile: any;
}

const Layout: React.FC<LayoutProps> = ({ children, profile }) => {
  const accountDropdownRef = useRef<any>({});
  const supabase = useSupabaseClient();

  console.log(profile);

  async function logout() {
    await supabase.auth.signOut();
  }

  function AvatarProfile() {
    return (
      profile && (
        <img
          src={profile.avatar || ""}
          alt={`${profile.name}'s avatar`}
          className="w-12 rounded-full"
        />
      )
    );
  }
  return (
    <>
      <Head>
        <title>Verby </title>
        <meta name="description" content="Generated by create-t3-app" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="min-h-screen bg-gradient-to-b from-[#f1f1f1] to-[#e9e9e9] pl-6 pt-4 ">
        <AccountLayoutStyle className="flex items-center p-4">
          <Dropdown
            id="voiceDropdown"
            ref={accountDropdownRef}
            image={<AvatarProfile />}
          >
            {/* <ul>
            <li>Logout</li>
          </ul> */}
            <div className="p-1" role="none">
              <button
                onClick={logout}
                className="inline-flex w-full rounded-md px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                role="menuitem"
                tabIndex={-1}
                id="menu-item-3"
              >
                <LogoutIcon /> Log out
              </button>
            </div>
          </Dropdown>
          <span className="pl-4 font-bold">
            {}
            {profile && profile.name}
          </span>
          {/* <Navbar>
          <Link href="/about">
            <NavLink>About</NavLink>
          </Link>
          <Link href="/contact">
            <NavLink>Contact</NavLink>
          </Link>
        </Navbar> */}
        </AccountLayoutStyle>

        {children}
      </main>
    </>
  );
};

export default Layout;
