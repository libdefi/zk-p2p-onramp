import React, { useState } from 'react';
import styled from 'styled-components';

import { Button } from "../components/Button";
import { Col, SubHeader } from "../components/Layout";
import { NumberedStep } from "../components/NumberedStep";
import { ReadOnlyInput } from "../components/ReadOnlyInput";
import { SingleLineInput } from "../components/SingleLineInput";

import { encryptMessage } from "../helpers/messagEncryption";
import { generateVenmoIdHash } from "../helpers/venmoHash";


interface ClaimOrderFormProps {
  senderEncryptingKey: string;
  senderAddressDisplay: string;
  senderRequestedAmountDisplay: number;
  setRequestedUSDAmount: (key: number) => void;
  setEncryptedVenmoId: (key: string) => void;
  setHashedVenmoId: (key: string) => void;
  writeClaimOrder?: () => void;
  isWriteClaimOrderLoading: boolean;
}
 
export const ClaimOrderForm: React.FC<ClaimOrderFormProps> = ({
  senderEncryptingKey,
  senderAddressDisplay,
  senderRequestedAmountDisplay,
  setRequestedUSDAmount,
  setEncryptedVenmoId,
  setHashedVenmoId,
  writeClaimOrder,
  isWriteClaimOrderLoading
}) => {
  const [venmoIdInput, setVenmoIdInput] = useState<string>("");
  const [requestedUSDAmountInput, setRequestedUSDAmountInput] = useState<number>(0);

  return (
    <ClaimOrderFormHeaderContainer>
      <SubHeader>Claim Order</SubHeader>
      <ClaimOrderBodyContainer>
        <SelectedOrderContainer>
          <ReadOnlyInput
            label="Order Creator"
            value={senderAddressDisplay}
          />
          <ReadOnlyInput
            label="Amount (USDC)"
            value={senderRequestedAmountDisplay}
          />
        </SelectedOrderContainer>
        <NumberedInputContainer>
          <NumberedStep>
            Specify a Venmo ID to receive USD at [INSERT link to gist to retreive your Venmo ID] and a required USD amount to receive. Your Venmo ID will be encrypted using a key provided by the on-ramper. This will lock {senderRequestedAmountDisplay} fUSDC for the user to unlock with a proof.
          </NumberedStep>
        </NumberedInputContainer>
        <InputsContainer>
          <SingleLineInput
            label="Venmo ID"
            value={venmoIdInput}
            placeholder={'1234567891011121314'}
            onChange={(e) => {
              setVenmoIdInput(e.currentTarget.value);
            }}
          />
          <SingleLineInput
            label="USD Amount to Receive"
            value={requestedUSDAmountInput === 0 ? '' : requestedUSDAmountInput.toString()}
            placeholder={'0'}
            onChange={(e) => {
              setRequestedUSDAmountInput(e.currentTarget.value);
            }}
          />
        </InputsContainer>
        <Button
          disabled={isWriteClaimOrderLoading}
          onClick={async () => {
            // Sign venmo id with encrypting key from the order
            const encryptedVenmoId = await encryptMessage(venmoIdInput, senderEncryptingKey);
            setEncryptedVenmoId(encryptedVenmoId);
            console.log(encryptedVenmoId);

            // Generate hash of the venmo id
            const hashedVenmoId = await generateVenmoIdHash(venmoIdInput);
            setHashedVenmoId(hashedVenmoId);
            console.log(hashedVenmoId);

            // Set the requested USD amount
            setRequestedUSDAmount(requestedUSDAmountInput);

            writeClaimOrder?.();
          }}
          >
          Claim Order
        </Button>
      </ClaimOrderBodyContainer>
    </ClaimOrderFormHeaderContainer>
  );
};

const SelectedOrderContainer = styled(Col)`
  background: rgba(255, 255, 255, 0.1);
  gap: 1rem;
  border-radius: 4px;
  padding: 1rem;
  color: #fff;
`;

const ClaimOrderFormHeaderContainer = styled.div`
  gap: 1rem;
`;

const ClaimOrderBodyContainer = styled(Col)`
  gap: 2rem;
`;

const NumberedInputContainer = styled(Col)`
  gap: 1rem;
`;

const InputsContainer = styled(Col)`
  gap: 1rem;
`;