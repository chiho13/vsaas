import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "@supabase/auth-helpers-react";
import { useRouter } from "next/router";
import Layout from "./layout";
import { NextPage } from "next";
import { DashboardHeader } from "@/components/AccountSettingsNav/header";
import { useUserContext } from "@/contexts/UserContext";

const Account: NextPage = () => {
  const session = useSession();
  const router = useRouter();

  const { profile } = useUserContext();

  useEffect(() => {
    if (!session) {
      router.push(`/login?next=${encodeURIComponent(router.asPath)}`);
    }
  }, [session, router]);

  return (
    <Layout titlePage="Billing">
      <div className="grid items-start gap-8">
        <DashboardHeader
          heading="Billing"
          text="Manage billing and your subscription plan."
        />
        <div className="mt-4 px-2">
          subscribed: {profile?.is_subscribed ? "true" : "false"}
        </div>
      </div>
    </Layout>
  );
};

export default Account;
