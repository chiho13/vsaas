import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { useRouter } from "next/router";
import { type NextPage } from "next";
import Head from "next/head";
import { Header } from "@/components/Header";
import React, { useState, useEffect } from "react";
import { useSession } from "@supabase/auth-helpers-react";
import { Check } from "lucide-react";
import { api } from "@/utils/api";
import { useTheme } from "styled-components";
import styled from "styled-components";
import { motion, AnimatePresence } from "framer-motion";
import { getStripe } from "@/utils/stripe-client";
import LoadingSpinner from "@/icons/LoadingSpinner";
import { useUserContext } from "@/contexts/UserContext";
import Link from "next/link";

const PricingStyle = styled.section`
  .upgrade-section {
    margin-top: 100px;
  }
  .subscribe-btn {
    position: absolute;
    overflow: hidden;
    transition: all 0.2s ease-in-out;
    display: inline-block;
    text-decoration: none;
    border-radius: 4px;
  }

  .subscribe-btn span {
    position: relative;
    color: white;
  }

  .subscribe-btn::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: linear-gradient(to right, #1895f4, #1e79e8);
    opacity: 0;
    transition: opacity 0.2s ease-in-out;
    border-radius: 4px;
  }

  .subscribe-btn:hover::before {
    opacity: 1;
  }
`;

const Upgrade = () => {
  const supabase = useSupabaseClient();

  const theme = useTheme();
  const router = useRouter();
  const workspaceId = router.query.workspaceId as string;

  const session = useSession();
  const [loading, setLoading] = useState(null);

  const [toggle, setToggle] = useState(true);
  const toggleClass = " transform translate-x-[22px]";
  //   const queryResult = api.checkout.fetchProducts.useQuery();
  //   const { data } = queryResult;

  //   const prices = data && data;

  const [selectedPrice, setSelectedPrice] = useState("");
  const { profile, isLoading }: any = useUserContext();

  useEffect(() => {
    if (profile) {
      setLoading(false);
    }
  }, [profile]);

  const createCheckoutSessionMutation =
    api.checkout.createCheckoutSession.useMutation();

  const createCheckoutSession = async (_price: string, _credits: string) => {
    if (loading) return;
    try {
      setLoading({
        [_price]: true,
      });
      const { checkoutUrl } = await createCheckoutSessionMutation.mutateAsync({
        price: _price,
        credits: _credits,
        workspaceId,
      });

      if (checkoutUrl) {
        void router.push(checkoutUrl);
      }
      setLoading({});
      // stripe?.redirectToCheckout({ sessionId });
    } catch (error) {
      setLoading({});
      console.error("Error creating checkout session:", error);
    }
  };

  useEffect(() => {
    if (!session) {
      router.push(`/login?next=${encodeURIComponent(router.asPath)}`);
    }
  }, [session, router]);

  const priceVariants = {
    hidden: { opacity: 0, scale: 0.6 },
    visible: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.6 },
  };

  console.log(profile?.is_subscribed);
  const PriceCards = [
    {
      credits: "25K credits",
      creditNumber: "25000",
      price: "9",
      audioTime: "~ 30 mins of Text to MP3",
      imageGen: "~ 100 AI Images",
      aiGen: " ~ 500 AI commands",
      // checkoutId: "price_1NYZetGj8eKfeqglBABHcdUX", test
      checkoutId: "price_1NcVytGj8eKfeqglXFrcKN1k",
    },
    {
      credits: "100K credits",
      creditNumber: "100000",
      price: "39",
      audioTime: "~ 2 hours of Text to MP3",
      imageGen: "~ 400 AI Images",
      aiGen: " ~ 2000 AI commands",
      // checkoutId: "price_1NYZf9Gj8eKfeqgllX2ANd5a",  //test
      checkoutId: "price_1NcVz8Gj8eKfeqgludoALK8U",
    },
    {
      credits: "400K credits",
      creditNumber: "400000",
      price: "89",
      audioTime: "~ 8 hours of Text to MP3",
      imageGen: "~ 1600 AI Images",
      aiGen: " ~ 8000 AI commands",
      // checkoutId: "price_1NYZfUGj8eKfeqgleSwh2oMo", test
      checkoutId: "price_1NcVzEGj8eKfeqglgqyrMojV",
    },
    // {
    //   credits: "7-day Access",
    //   price: "49",
    //   audioTime: "Unlimited Words",
    //   checkoutId: "price_1NX6kZGj8eKfeqglc8U3gFRc",
    // },
    // {
    //   credits: "30-day Access",
    //   price: "199",
    //   audioTime: "Unlimited Words",
    //   checkoutId: "price_1NX6kzGj8eKfeqglERCZRSZf",
    //   extra: "Priority Support",
    // },
    // {
    //   credits: "6-month Access",
    //   price: "699",
    //   audioTime: "Unlimited Words",
    //   checkoutId: "price_1NX6kzGj8eKfeqglERCZRSZf",
    //   extra: "Priority Support",
    // },
  ];

  const PriceCard = ({
    credits,
    creditNumber,
    price,
    audioTime,
    imageGen,
    aiGen,
    checkoutId,
    createCheckoutSession,
  }) => {
    return (
      <div className="relative z-10 flex flex-col rounded-xl  border border-gray-200 bg-white px-8 py-10 shadow-md  dark:bg-secondary sm:p-12 lg:grid-cols-2 lg:px-6 lg:px-8 lg:py-6 ">
        <div className="relative grow ">
          <span className=" block   bg-gradient-to-r from-blue-500 to-sky-400 bg-clip-text text-[20px] font-semibold text-transparent ">
            {credits}
          </span>

          <div className="relative">
            <h2 className=" relative mt-1  flex text-[30px] font-bold text-gray-500  dark:text-muted-foreground  ">
              $<span className="block text-foreground ">{price}</span>
            </h2>
          </div>

          <div className="relative mb-5 mt-3 h-[40px]">
            <button
              onClick={() => createCheckoutSession(checkoutId, creditNumber)}
              className="subscribe-btn flex h-[40px] w-full items-center justify-center rounded-md   bg-gradient-to-r from-blue-500 to-sky-400 text-center text-base  font-semibold text-white transition"
            >
              <div className="flex items-center justify-center">
                <span className="text-md ml-2">Purchase</span>
              </div>
            </button>
          </div>
          <div className="relative mb-7 block ">
            <p className="mt-3 flex items-center text-left text-base text-sm font-semibold leading-loose text-gray-500 dark:text-gray-400">
              <div className="flex h-[16px] w-[16px] items-center justify-center rounded-full bg-gray-400 dark:bg-foreground">
                <Check className="w-3 text-white dark:text-background" />
              </div>
              <span className="mr-6 shrink bg-gradient-to-r from-blue-500 to-sky-500   bg-clip-text pl-2 text-transparent">
                {audioTime}
              </span>
            </p>
            <p className="mt-3 flex  items-center text-left text-base text-sm font-semibold leading-loose text-gray-500 dark:text-gray-400">
              <div className="flex h-[16px] w-[16px] items-center justify-center rounded-full bg-gray-400 dark:bg-foreground">
                <Check className="w-3 text-white dark:text-background" />
              </div>
              <span className="mr-6 shrink bg-gradient-to-r from-blue-500 to-sky-500   bg-clip-text pl-2 text-transparent">
                {imageGen}
              </span>
            </p>
            <p className="mt-3 flex  items-center text-left text-base text-sm font-semibold leading-loose text-gray-500 dark:text-gray-400">
              <div className="flex h-[16px] w-[16px] items-center justify-center rounded-full bg-gray-400 dark:bg-foreground">
                <Check className="w-3 text-white dark:text-background" />
              </div>
              <span className="mr-6 shrink bg-gradient-to-r from-blue-500 to-sky-500   bg-clip-text pl-2 text-transparent">
                {aiGen}
              </span>
            </p>
            <p className="mt-2 flex  items-center text-left text-sm font-semibold leading-loose text-gray-500  dark:text-gray-400">
              <div className="flex h-[16px] w-[16px] items-center justify-center rounded-full bg-gray-400 dark:bg-foreground">
                <Check className="w-3 text-white dark:text-black" />
              </div>
              <span className="pl-2">One time payment</span>
            </p>

            <p className="mt-3 flex items-center text-left text-sm  font-semibold  leading-loose text-gray-500 dark:text-gray-400">
              <div className="flex h-[16px] w-[16px] items-center justify-center rounded-full bg-gray-400 dark:bg-foreground">
                <Check className="w-3 text-white dark:text-background" />
              </div>
              <span className="pl-2">No subscription</span>
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <PricingStyle>
      <div className="container mx-auto">
        <div className="w-full px-4">
          <div className="mx-auto mb-[20px] mt-10 max-w-[510px] text-center lg:mb-5">
            <h1 className="mb-7 mr-6 bg-gradient-to-r from-blue-500 to-sky-400 bg-clip-text text-3xl   font-bold text-transparent sm:text-4xl">
              Simple Pricing
            </h1>
          </div>
        </div>
        <div className="relative -mx-4 mb-4 flex justify-center px-10">
          <div className="grid w-full grid-cols-3 gap-4">
            {PriceCards.map((card, index) => (
              <PriceCard
                key={index}
                credits={card.credits}
                creditNumber={card.creditNumber}
                price={card.price}
                audioTime={card.audioTime}
                imageGen={card.imageGen}
                aiGen={card.aiGen}
                checkoutId={card.checkoutId}
                createCheckoutSession={createCheckoutSession}
              />
            ))}
          </div>
        </div>
      </div>
    </PricingStyle>
  );
};

export default Upgrade;
