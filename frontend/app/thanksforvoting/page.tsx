'use client';

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSuiClient } from "@mysten/dapp-kit";
import { useEnokiFlow, useZkLogin } from "@mysten/enoki/react";
import { BalanceChange } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { track } from "@vercel/analytics/react";
import { ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { ZkSendLinkBuilder } from '@mysten/zksend';
import { getFaucetHost, requestSuiFromFaucetV0 } from "@mysten/sui/faucet";
import { IconBrandX } from '@tabler/icons-react';
import FUD from "@/public/plotting.webp"



export default function Page() {

  const client = useSuiClient(); // The SuiClient instance
  const enokiFlow = useEnokiFlow(); // The EnokiFlow instance
  const { address: suiAddress } = useZkLogin(); // The zkLogin instance

  /* Transfer form state */
  const [recipientAddress, setRecipientAddress] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [transferLoading, setTransferLoading] = useState<boolean>(false);

  const requestSui = async () => {
    track("Request SUI");

    // Ensures the user is logged in and has a SUI address.
    if (!suiAddress) {
      throw new Error("No SUI address found");
    }

    // Request SUI from the faucet.
    const res = await requestSuiFromFaucetV0({
      host: getFaucetHost("testnet"),
      recipient: suiAddress,
    });

    if (res.error) {
      throw new Error(res.error);
    }

    return res;
  };

  async function generateStashedLink() {

    await requestSui();

    const txb = new Transaction();
 
    const link = new ZkSendLinkBuilder({
      sender: '0x...',
    });
    
    // link.addClaimableObjectRef(
    //   txb.object(""),
    //   `${process.env.VOTING_MODULE_ADDRESS}::your_module::YourType`,
    // );
    
    // Adds the link creation transactions to the transaction
    link.createSendTransaction({
      transaction: txb,
    });

    console.log('link', link.getLink());

    // Get the keypair for the current user.
    const keypair = await enokiFlow.getKeypair({ network: "testnet" });

    const {bytes, signature} = await txb.sign({ client, signer: keypair });
 
    const res = await client.executeTransactionBlock({
      transactionBlock: bytes,
      signature,
    });

    console.log('res', res);
  }

  async function transferSui() {
    const promise = async () => {
      track("Transfer SUI");

      setTransferLoading(true);

      // Validate the transfer amount
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount)) {
        setTransferLoading(false);
        throw new Error("Invalid amount");
      }

      // Get the keypair for the current user.
      const keypair = await enokiFlow.getKeypair({ network: "testnet" });

      // Create a new transaction block
      const txb = new Transaction();

      // Add some transactions to the block...
      const [coin] = txb.splitCoins(txb.gas, [
        txb.pure.u64(parsedAmount * 10 ** 9),
      ]);
      txb.transferObjects([coin], txb.pure.address(recipientAddress));

      // Sign and execute the transaction block, using the Enoki keypair
      const res = await client.signAndExecuteTransaction({
        signer: keypair,
        transaction: txb,
        options: {
          showEffects: true,
          showBalanceChanges: true,
        },
      });

      setTransferLoading(false);

      console.log("Transfer response", res);

      if (res.effects?.status.status !== "success") {
        throw new Error(
          "Transfer failed with status: " + res.effects?.status.error
        );
      }

      return res;
    };

    toast.promise(promise, {
      loading: "Transfer SUI...",
      success: (data) => {
        return (
          <span className="flex flex-row items-center gap-2">
            Transfer successful!{" "}
            <a
              href={`https://suiscan.xyz/testnet/tx/${data.digest}`}
              target="_blank"
            >
              <ExternalLink width={12} />
            </a>
          </span>
        );
      },
      error: (error) => {
        return error.message;
      },
    });
  }

  return (
    <div className="flex flex-col items-center justify-center w-full h-full min-h-screen px-4 gap-8">
      <div className="flex flex-col items-center">
        <h1 className="text-3xl font-medium text-deep-ocean tracking-tight">Thanks for voting!</h1>
        <p className="text-lg text-ocean text-center">
          Your vote has been recorded. We&apos;ll announce the winners soon!
        </p>
      </div>
      
      <Image className="rounded-2xl" src={FUD} alt="FUD" width={300} height={300} />

      <a href={`https://twitter.com/intent/tweet?text=I%20just%20received%20an%20NFT%20for%20participating%20in%20the%20Sui%20Overflow%20community%20vote!%20https://overflow-voting-app-git-main-sui-foundation.vercel.app/`}>
        <Button variant={"outline"} >
          Share your vote on <IconBrandX />
        </Button>
      </a>
    </div>
  )
}