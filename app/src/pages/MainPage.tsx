// @ts-ignore
import React, { useEffect, useState } from "react";
import { useMount } from "react-use";

// @ts-ignore
import styled from "styled-components";
import { Button } from "../components/Button";
import { ClaimOrderForm } from "../components/ClaimOrderForm";
import { Col, Header, SubHeader } from "../components/Layout";
import { NewOrderForm } from "../components/NewOrderForm";
import { NumberedStep } from "../components/NumberedStep";
import { OrderTable } from '../components/OrderTable';
import { SubmitOrderClaimsForm } from "../components/SubmitOrderClaimsForm";
import { SubmitOrderGenerateProofForm } from "../components/SubmitOrderGenerateProofForm";
import { SubmitOrderOnRampForm } from "../components/SubmitOrderOnRampForm";
import { TopBanner } from "../components/TopBanner";

import {
  useAccount, 
  useContractWrite, 
  useContractRead, 
  useNetwork, 
  usePrepareContractWrite,
} from "wagmi";

import { abi } from "../helpers/ramp.abi";
import { contractAddresses } from "../helpers/deployed_addresses";
import { OnRampOrder, OnRampOrderClaim } from "../helpers/types";
import { UINT256_MAX } from "../helpers/constants";
import { formatAmountsForUSDC, getOrderStatusString } from '../helpers/tableFormatters';

enum FormState {
  DEFAULT = "DEFAULT",
  NEW = "NEW",
  CLAIM = "CLAIM",
  UPDATE = "UPDATE",
}


export const MainPage: React.FC<{}> = (props) => {
  /*
    App State
  */

  const { address } = useAccount();
  const [ethereumAddress, setEthereumAddress] = useState<string>(address ?? "");
  const [showBrowserWarning, setShowBrowserWarning] = useState<boolean>(false);
  
  // ----- application state -----
  const [actionState, setActionState] = useState<FormState>(FormState.DEFAULT);
  const [selectedOrder, setSelectedOrder] = useState<OnRampOrder>({} as OnRampOrder);
  const [selectedOrderClaim, setSelectedOrderClaim] = useState<OnRampOrderClaim >({} as OnRampOrderClaim);
  
  // ----- transaction state -----
  const [newOrderAmount, setNewOrderAmount] = useState<number>(0);
  const [newOrderVenmoIdEncryptingKey, setNewOrderVenmoIdEncryptingKey] = useState<string>('');

  const [claimOrderEncryptedVenmoId, setClaimOrderEncryptedVenmoId] = useState<string>('');
  const [claimOrderHashedVenmoHandle, setClaimOrderHashedVenmoId] = useState<string>('');
  const [claimOrderRequestedAmount, setClaimOrderRequestedAmount] = useState<number>(0);

  const [submitOrderPublicSignals, setSubmitOrderPublicSignals] = useState<string>('');
  const [submitOrderProof, setSubmitOrderProof] = useState<string>('');
  
  // fetched on-chain state
  const [fetchedOrders, setFetchedOrders] = useState<OnRampOrder[]>([]);
  const [fetchedOrderClaims, setFetchedOrderClaims] = useState<OnRampOrderClaim[]>([]);

  const { chain } = useNetwork()
  console.log("Chain: ", chain);

  const formatAmountsForTransactionParameter = (tokenAmount: number) => {
    const adjustedAmount = tokenAmount * (10 ** 6);
    return adjustedAmount;
  };

  // order table state
  const orderTableHeaders = ['Creator', 'Requested USDC Amount', 'Status'];
  const orderTableData = fetchedOrders.map((order) => [
    formatAddressForTable(order.onRamper),
    formatAmountsForUSDC(order.amountToReceive),
    getOrderStatusString(order),
  ]);

  /*
    Misc Helpers
  */

  function formatAddressForTable(addressToFormat: string) {
    if (addressToFormat === address) {
      return "You";
    } else {
      const prefix = addressToFormat.substring(0, 4);
      const suffix = addressToFormat.substring(addressToFormat.length - 4);
      return `${prefix}...${suffix}`;
    }
  }

  /*
    Contract Reads
  */

  // getAllOrders() external view returns (Order[] memory) {
  const {
    data: allOrders,
    isLoading: isReadAllOrdersLoading,
    isError: isReadAllOrdersError,
    refetch: refetchAllOrders,
  } = useContractRead({
    addressOrName: contractAddresses["goerli"]["ramp"],
    contractInterface: abi,
    functionName: 'getAllOrders',
  });

  // getClaimsForOrder(uint256 _orderId) external view returns (OrderClaim[] memory) {
  const {
    data: orderClaimsData,
    isLoading: isReadOrderClaimsLoading,
    isError: isReadOrderClaimsError,
    refetch: refetchClaimedOrders,
  } = useContractRead({
    addressOrName: contractAddresses["goerli"]["ramp"],
    contractInterface: abi,
    functionName: 'getClaimsForOrder',
    args: [selectedOrder.orderId],
  });

  /*
    Contract Writes
  */

  //
  // legacy: postOrder(uint256 _amount, uint256 _maxAmountToPay)
  // new:    postOrder(uint256 _amount, uint256 _maxAmountToPay, bytes calldata _encryptPublicKey)
  //
  const { config: writeCreateOrderConfig } = usePrepareContractWrite({
    addressOrName: contractAddresses["goerli"]["ramp"],
    contractInterface: abi,
    functionName: 'postOrder',
    args: [
      formatAmountsForTransactionParameter(newOrderAmount),
      UINT256_MAX,
      '0x' + newOrderVenmoIdEncryptingKey
    ],
    onError: (error: { message: any }) => {
      console.error(error.message);
    },
  });

  const {
    isLoading: isWriteNewOrderLoading,
    write: writeNewOrder
  } = useContractWrite(writeCreateOrderConfig);

  //
  // legacy: claimOrder(uint256 _orderNonce)
  // new:    claimOrder(uint256 _venmoId, uint256 _orderNonce, bytes calldata _encryptedVenmoId, uint256 _minAmountToPay)
  //
  const { config: writeClaimOrderConfig } = usePrepareContractWrite({
    addressOrName: contractAddresses["goerli"]["ramp"],
    contractInterface: abi,
    functionName: 'claimOrder',
    args: [
      claimOrderHashedVenmoHandle,
      selectedOrder.orderId,
      '0x' + claimOrderEncryptedVenmoId,
      formatAmountsForTransactionParameter(claimOrderRequestedAmount)

    ],
    onError: (error: { message: any }) => {
      console.error(error.message);
    },
  });

  const {
    isLoading: isWriteClaimOrderLoading,
    write: writeClaimOrder
  } = useContractWrite(writeClaimOrderConfig);


  //
  // legacy: onRamp(uint256 _orderId, uint256 _offRamper, VenmoId, bytes calldata _proof)
  // new:    onRamp(uint256[2] memory _a, uint256[2][2] memory _b, uint256[2] memory _c, uint256[msgLen] memory _signals, uint256 claimId)
  //
  const reformatProofForChain = (proof: string) => {
    return [
      proof ? JSON.parse(proof)["pi_a"].slice(0, 2) : null,
      proof
        ? JSON.parse(proof)
            ["pi_b"].slice(0, 2)
            .map((g2point: any[]) => g2point.reverse())
        : null,
      proof ? JSON.parse(proof)["pi_c"].slice(0, 2) : null,
    ];
  };

  const { config: writeCompleteOrderConfig } = usePrepareContractWrite({
    addressOrName: contractAddresses["goerli"]["ramp"],
    contractInterface: abi,
    functionName: 'onRamp',
    args: [
      ...reformatProofForChain(submitOrderProof),
      submitOrderPublicSignals ? JSON.parse(submitOrderPublicSignals) : null,
      selectedOrderClaim.claimId
    ],
    onError: (error: { message: any }) => {
      console.error(error.message);
    },
  });

  const {
    isLoading: isWriteCompleteOrderLoading,
    write: writeCompleteOrder
  } = useContractWrite(writeCompleteOrderConfig);

  /*
    Hooks
  */

  // Fetch Orders
  useEffect(() => {
    if (!isReadAllOrdersLoading && !isReadAllOrdersError && allOrders) {
      const sanitizedOrders: OnRampOrder[] = [];
      for (let i = 0; i < allOrders.length; i++) {
        const rawOrderData = allOrders[i];
        const orderData = rawOrderData.order;

        const orderId = rawOrderData.id.toString();
        const onRamper = orderData.onRamper;
        const onRamperEncryptPublicKey = orderData.onRamperEncryptPublicKey.substring(2);
        const amountToReceive = orderData.amountToReceive;
        const maxAmountToPay = orderData.maxAmountToPay;
        const status = orderData.status;

        // console.log("Order: ");
        // console.log(orderId);
        // console.log(onRamper);
        // console.log(onRamperEncryptPublicKey);
        // console.log(amountToReceive);
        // console.log(maxAmountToPay);
        // console.log(status);

        const order: OnRampOrder = {
          orderId,
          onRamper,
          onRamperEncryptPublicKey,
          amountToReceive,
          maxAmountToPay,
          status,
        };

        sanitizedOrders.push(order);
      }

      setFetchedOrders(sanitizedOrders);
    }
  }, [allOrders, isReadAllOrdersLoading, isReadAllOrdersError]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      refetchAllOrders();
    }, 15000); // Refetch every 15 seconds

    return () => {
      clearInterval(intervalId);
    };
  }, [refetchAllOrders]);

  // Fetch Order Claims
  useEffect(() => {
    if (!isReadOrderClaimsLoading && !isReadOrderClaimsError && orderClaimsData) {
      const sanitizedOrderClaims: OnRampOrderClaim[] = [];
      for (let i = 0; i < orderClaimsData.length; i++) {
        const claimsData = orderClaimsData[i];

        const claimId = i;
        const offRamper = claimsData.offRamper.toString();
        const hashedVenmoId = claimsData.venmoId;
        const status = claimsData.status; 
        const encryptedOffRamperVenmoId = claimsData.encryptedOffRamperVenmoId.substring(2);
        const claimExpirationTime = claimsData.claimExpirationTime.toString();
        const minAmountToPay = claimsData.minAmountToPay.toString();

        // console.log("Order claim: ");
        // console.log(claimId);
        // console.log(offRamper);
        // console.log(hashedVenmoId);
        // console.log(status);
        // console.log(encryptedOffRamperVenmoId);
        // console.log(claimExpirationTime);
        // console.log(minAmountToPay);
        
        const orderClaim: OnRampOrderClaim = {
          claimId,
          offRamper,
          hashedVenmoId,
          status,
          encryptedOffRamperVenmoId,
          claimExpirationTime,
          minAmountToPay,
        };

        sanitizedOrderClaims.push(orderClaim);
      }

      setFetchedOrderClaims(sanitizedOrderClaims);
    }
  }, [orderClaimsData, isReadOrderClaimsLoading, isReadOrderClaimsError]);

  useEffect(() => {
    if (selectedOrder) {
      const intervalId = setInterval(() => {
        refetchClaimedOrders();
      }, 15000); // Refetch every 15 seconds
  
      return () => {
        clearInterval(intervalId);
      };
    }
  }, [selectedOrder, refetchClaimedOrders]);

  useEffect(() => {
    const userAgent = navigator.userAgent;
    const isChrome = userAgent.indexOf("Chrome") > -1;
    if (!isChrome) {
      setShowBrowserWarning(true);
    }
  }, []);

  useEffect(() => {
    if (address) {
      setEthereumAddress(address);
    } else {
      setEthereumAddress("");
    }
  }, [address]);

  /*
    Additional Listeners
  */

  useMount(() => {
    function handleKeyDown() {
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const handleOrderRowClick = (rowData: any[]) => {
    const [rowIndex] = rowData;
    const orderToSelect = fetchedOrders[rowIndex];

    if (orderToSelect.onRamper === address) {
      setActionState(FormState.UPDATE);
    } else {
      setActionState(FormState.CLAIM);
    }
    // setActionState(FormState.UPDATE);

    setSelectedOrderClaim({} as OnRampOrderClaim);
    setSelectedOrder(orderToSelect);
  };

  /*
    Container
  */

  return (
    <Container>
      {showBrowserWarning && <TopBanner message={"ZK P2P On-Ramp only works on Chrome or Chromium-based browsers."} />}
      <div className="title">
        <Header>ZK P2P On-Ramp From Venmo</Header>
        <NumberedInputContainer>
          <NumberedStep step={1}>
            Step 1 Instructions: disclaimer this is an experimental application showcasing ZKP technology
          </NumberedStep>
          <NumberedStep step={2}>
            Step 2 Instructions: when off-ramping, be prepared to look up your Venmo Id. You will also need to mint fUSDC from the contract directly and approve allowance to the smart contract
          </NumberedStep>
        </NumberedInputContainer>
      </div>
      <Main>
        <Column>
          <SubHeader>Orders</SubHeader>
          <OrderTable
            headers={orderTableHeaders}
            data={orderTableData}
            onRowClick={handleOrderRowClick}
            selectedRow={selectedOrder.orderId - 1}
            rowsPerPage={10}
          />
          <Button
            onClick={async () => {
              setSelectedOrderClaim({} as OnRampOrderClaim);
              setSelectedOrder({} as OnRampOrder);
              setActionState(FormState.NEW);
            }}
          >
            New Order
          </Button>
        </Column>
        <Wrapper>
          {actionState === FormState.NEW && (
            <Column>
              <NewOrderForm
                loggedInWalletAddress={ethereumAddress}
                newOrderAmount={newOrderAmount}
                setNewOrderAmount={setNewOrderAmount}
                setVenmoIdEncryptingKey={setNewOrderVenmoIdEncryptingKey}
                writeNewOrder={writeNewOrder}
                isWriteNewOrderLoading={isWriteNewOrderLoading}
              />
            </Column>
          )}
          {actionState === FormState.CLAIM && (
            <Column>
              <ClaimOrderForm
                senderEncryptingKey={selectedOrder.onRamperEncryptPublicKey}
                senderAddressDisplay={selectedOrder.onRamper}
                senderRequestedAmountDisplay={formatAmountsForUSDC(selectedOrder.amountToReceive)}
                setRequestedUSDAmount={setClaimOrderRequestedAmount}
                setEncryptedVenmoId={setClaimOrderEncryptedVenmoId}
                setHashedVenmoId={setClaimOrderHashedVenmoId}
                writeClaimOrder={writeClaimOrder}
                isWriteClaimOrderLoading={isWriteClaimOrderLoading}
              />
            </Column>
          )}
          {actionState === FormState.UPDATE && (
            <ConditionalContainer>
              <Column>
                <SubmitOrderClaimsForm
                  loggedInWalletAddress={ethereumAddress}
                  orderClaims={fetchedOrderClaims}
                  currentlySelectedOrderClaim={selectedOrderClaim}
                  setSelectedOrderClaim={setSelectedOrderClaim}
                />
              </Column>
              <Column>
                <SubmitOrderGenerateProofForm
                  loggedInWalletAddress={ethereumAddress}
                  selectedOrder={selectedOrder}
                  setSubmitOrderProof={setSubmitOrderProof}
                  setSubmitOrderPublicSignals={setSubmitOrderPublicSignals}
                />
              </Column>
              <Column>
                <SubmitOrderOnRampForm
                  proof={submitOrderProof}
                  publicSignals={submitOrderPublicSignals}
                  setSubmitOrderProof={setSubmitOrderProof}
                  setSubmitOrderPublicSignals={setSubmitOrderPublicSignals}
                  writeCompleteOrder={writeCompleteOrder}
                  isWriteCompleteOrderLoading={isWriteCompleteOrderLoading}
                />
              </Column>
            </ConditionalContainer>
          )}
        </Wrapper>
      </Main>
    </Container>
  );
};

const ConditionalContainer = styled.div`
  display: grid;
  gap: 1rem;
  align-self: flex-start;
`;

const Main = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
`;

const Column = styled.div`
  gap: 1rem;
  align-self: flex-start;
  background: rgba(255, 255, 255, 0.1);
  padding: 1.5rem;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
`;

const Wrapper = styled.div`
  gap: 1rem;
  align-self: flex-start;
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  margin: 0 auto;
  & .title {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  & .main {
    & .signaturePane {
      flex: 1;
      display: flex;
      flex-direction: column;
      & > :first-child {
        height: calc(30vh + 24px);
      }
    }
  }

  & .bottom {
    display: flex;
    flex-direction: column;
    align-items: center;
    & p {
      text-align: center;
    }
    & .labeledTextAreaContainer {
      align-self: center;
      max-width: 50vw;
      width: 500px;
    }
  }
`;

const NumberedInputContainer = styled(Col)`
  gap: 1rem;
  width: 65%;
  margin-bottom: 2rem;
`;
