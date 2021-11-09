import { useState, useEffect, useCallback } from 'react';
import { Router, Switch, Route, Redirect, NavLink } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import jsonwebtoken from 'jsonwebtoken';
import setTitle from './utils/setTitle';

import './App.css';
import * as ethers from 'ethers'
import { getJWT, isTokenValid } from './utils/rFetch.js';

// React Redux types
import * as contractTypes from './ducks/contracts/types.js';
import * as colorTypes from './ducks/colors/types.js';
import * as userTypes from './ducks/users/types.js';
import * as authTypes from './ducks/auth/types.js';

// Sweetalert2 for the popup messages
import Swal from 'sweetalert2';

//import CSVParser from './components/metadata/csvParser.jsx';
import MetadataEditor from './components/metadata/metadataEditor.jsx';
import CreateBatchMetadata from './components/metadata/CreateBatchMetadata.jsx';
import BlockChainSwitcher from './components/adminViews/BlockchainSwitcher.jsx';

import MyContracts from './components/whitelabel/myContracts.jsx';
import MinterMarketplace from './components/marketplace/MinterMarketplace.jsx';

import CreatorMode from './components/creatorMode.jsx';
import ConsumerMode from './components/consumerMode.jsx';

// import VideoList from './components/video/videoList.jsx';
import VideoPlayer from './components/video/videoPlayer.jsx';
import FileUpload from './components/video/videoUpload/videoUpload.jsx';

import MyNFTs from './components/nft/myNFT.jsx';
import Token from './components/nft/Token.jsx';
import RairProduct from './components/nft/rairCollection.jsx';
import MockUpPage from './components/MockUpPage/MockUpPage';

import Deploy from './components/creatorStudio/Deploy.jsx';
import Contracts from './components/creatorStudio/Contracts.jsx';
import ContractDetails from './components/creatorStudio/ContractDetails.jsx';

// import MetamaskLogo from './images/metamask-fox.svg';
import * as Sentry from "@sentry/react";
import NftDataPage from './components/MockUpPage/NftList/NftData/NftDataPage';
import NftDataCommonLink from './components/MockUpPage/NftList/NftData/NftDataCommonLink';
import NftDataExternalLink from './components/MockUpPage/NftList/NftData/NftDataExternalLink';
import UserProfileSettings from './components/UserProfileSettings/UserProfileSettings';
import FormMetadata from './components/metadata';
// import NftList from './components/MockUpPage/NftList/NftList';
// import NftItem from './components/MockUpPage/NftList/NftItem';

const SentryRoute = Sentry.withSentryRouting(Route);

const ErrorFallback = () => {
	return <div className='bg-stiromol'>
		<h1> Whoops! </h1>
		An error has ocurred
	</div>
}

function App({ sentryHistory }) {

	const [/*userData*/, setUserData] = useState();
	const [adminAccess, setAdminAccess] = useState(undefined);
	const [startedLogin, setStartedLogin] = useState(false);
	const [loginDone, setLoginDone] = useState(false);
	const [errorAuth, setErrorAuth] = useState('');

	// Redux
	const dispatch = useDispatch()
	const { currentUserAddress, minterInstance, factoryInstance, programmaticProvider } = useSelector(store => store.contractStore);
	const { primaryColor, headerLogo, textColor, backgroundImage, backgroundImageEffect } = useSelector(store => store.colorStore);
	const { token } = useSelector(store => store.accessStore);
	const { showSidebar } = useSelector(store => store.metadataStore);
	console.log(showSidebar);

	const connectUserData = async () => {
		setStartedLogin(true);
		let currentUser;
		if (window.ethereum) {
			let accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
			dispatch({ type: contractTypes.SET_USER_ADDRESS, payload: accounts[0] });
			dispatch({
				type: contractTypes.SET_CHAIN_ID,
				payload: window.ethereum.chainId?.toLowerCase()
			});
			currentUser = accounts[0];
		} else if (programmaticProvider) {
			dispatch({ type: contractTypes.SET_USER_ADDRESS, payload: programmaticProvider.address });
			dispatch({
				type: contractTypes.SET_CHAIN_ID,
				payload: `0x${programmaticProvider.provider._network.chainId?.toString(16)?.toLowerCase()}`
			});
			currentUser = programmaticProvider.address;
		}

		if (!currentUser && currentUser !== undefined) {
			Swal.fire('Error', 'No user address found', 'error');
			setStartedLogin(false);
			return;
		}

		try {
			// Check if user exists in DB
			const { success, user } = await (await fetch(`/api/users/${currentUser}`)).json();
			if (!success || !user) {
				// If the user doesn't exist, send a request to register him using a TEMP adminNFT
				console.log('Address is not registered!');
				const userCreation = await fetch('/api/users', {
					method: 'POST',
					body: JSON.stringify({ publicAddress: currentUser, adminNFT: 'temp' }),
					headers: {
						Accept: 'application/json',
						'Content-Type': 'application/json'
					}
				})
				console.log('User Created', userCreation);
				setUserData(userCreation);
			} else {
				setUserData(user);
			}

			// Admin rights validation
			//let adminRights = adminAccess;
			if (adminAccess === undefined) {
				const { response } = await (await fetch(`/api/auth/get_challenge/${currentUser}`)).json();
				let ethResponse;
				let ethRequest = {
					method: 'eth_signTypedData_v4',
					params: [currentUser, response],
					from: currentUser
				}
				if (window.ethereum) {
					ethResponse = await window.ethereum.request(ethRequest);
				} else if (programmaticProvider) {
					let parsedResponse = JSON.parse(response);
					// EIP712Domain is added automatically by Ethers.js!
					let { EIP712Domain, ...revisedTypes } = parsedResponse.types;
					ethResponse = await programmaticProvider._signTypedData(
						parsedResponse.domain,
						revisedTypes,
						parsedResponse.message);
				} else {
					Swal.fire('Error', "Can't sign messages", 'error');
					console.log("Nahuy")
					return;
				}
				const adminResponse = await (await fetch(`/api/auth/admin/${JSON.parse(response).message.challenge}/${ethResponse}/`)).json();
				dispatch({ type: userTypes.SET_ADMIN_RIGHTS, payload: adminResponse.success });
				setAdminAccess(adminResponse.success);
				//adminRights = adminResponse.success;
			}

			let signer = programmaticProvider;

			if (window.ethereum) {
				let provider = new ethers.providers.Web3Provider(window.ethereum);
				signer = provider.getSigner();
			}

			if (!localStorage.token) {
				let token = await getJWT(signer, user, currentUser);

				dispatch({ type: authTypes.GET_TOKEN_START });
				dispatch({ type: authTypes.GET_TOKEN_COMPLETE, payload: token })
				console.log(token, "token");
				localStorage.setItem('token', token);
			}

			if (!isTokenValid(localStorage.token)) {
				let token = await getJWT(signer, user, currentUser);
				dispatch({ type: authTypes.GET_TOKEN_START });
				dispatch({ type: authTypes.GET_TOKEN_COMPLETE, payload: token })
				// dispatch({ type: authTypes.GET_TOKEN_ERROR, payload: null })
				localStorage.setItem('token', token);
			}

			setStartedLogin(false);
			setLoginDone(true);
		} catch (err) {
			console.log("Error", err)
			setStartedLogin(false);
		}
	};

	const goHome = () => {
		sentryHistory.push(`/`)
	}

	useEffect(() => {
		if (window.ethereum) {
			window.ethereum.on('chainChanged', async (chainId) => {
				dispatch({ type: contractTypes.SET_CHAIN_ID, payload: chainId });
			});
		}
	}, [dispatch])

	useEffect(() => {
		setTitle('Welcome');
	}, [])

	const checkToken = useCallback(() => {
		const token = localStorage.getItem('token');
		if (!isTokenValid(token)) {
			connectUserData()
			dispatch({ type: authTypes.GET_TOKEN_START });
			dispatch({ type: authTypes.GET_TOKEN_COMPLETE, payload: token })
		}
	}, [token])


	useEffect(() => {
		let timeout;
		if (token) {
			const decoded = jsonwebtoken.decode(token);

			if (decoded?.exp) {

				timeout = setTimeout(() => {
					connectUserData()
				}, decoded.exp * 1000)
			}
		}
		return () => {
			if (timeout) {
				clearTimeout(timeout);
			}
		}
	}, [token])

	useEffect(() => {
		if (localStorage.token && isTokenValid(localStorage.token)) {
			connectUserData()
			dispatch({ type: authTypes.GET_TOKEN_START });
			dispatch({ type: authTypes.GET_TOKEN_COMPLETE, payload: token })
		}
	}, [])

	useEffect(() => {
		checkToken();
	}, [checkToken, token])


	return (
		<Sentry.ErrorBoundary fallback={ErrorFallback}>
			<Router history={sentryHistory}>
				{currentUserAddress === undefined && !window.ethereum && <Redirect to='/admin' />}
				{!loginDone && <Redirect to="/all" />}
				<div
					style={{
						...backgroundImageEffect,
						backgroundSize: '100vw 100vh',
						minHeight: '100vh',
						position: 'relative',
						backgroundColor: `var(--${primaryColor})`,
						color: textColor,
						backgroundImage: `url(${backgroundImage})`,
						backgroundPosition: 'center top',
						backgroundRepeat: 'no-repeat',
					}}
					className="App p-0 container-fluid">
					<UserProfileSettings
						errorAuth={errorAuth}
						adminAccess={adminAccess}
						primaryColor={primaryColor}
						currentUserAddress={currentUserAddress}
						loginDone={loginDone}
						setLoginDone={setLoginDone}
					/>
					<div className='row w-100 m-0 p-0'>

						{!showSidebar &&
							<div
								className='col-12 pt-2 mb-4'
								style={{ height: '10vh', position: 'relative', left: '-40%' }}
							>
								<img onClick={() => goHome()} alt='Header Logo' src={headerLogo} className='h-100 header_logo' />
							</div>
						}

						{showSidebar && <div className='col-1 d-none d-xl-inline-block' />}
						{showSidebar &&
							<div className='col-1 rounded'>
								<div className='col-12 pt-2 mb-4' style={{ height: '10vh' }}>
									<img onClick={() => goHome()} alt='Header Logo' src={headerLogo} className='h-100 header_logo' />
								</div>
								{!loginDone ? <div className='btn-connect-wallet-wrapper'>
									<button disabled={!window.ethereum && !programmaticProvider && !startedLogin}
										className={`btn btn-${primaryColor} btn-connect-wallet`}
										onClick={connectUserData}>
										{startedLogin ? 'Please wait...' : 'Connect Wallet'}
									</button></div> : [
										{ name: <i className="fas fa-photo-video" />, route: '/all', disabled: !loginDone },
										{ name: <i className='fas fa-search' />, route: '/search' },
										{ name: <i className='fas fa-user' />, route: '/user' },
										{ name: <i className="fas fa-key" />, route: '/my-nft' },
										{ name: <i className="fa fa-id-card" aria-hidden="true" />, route: '/new-factory', disabled: !loginDone },
										{ name: <i className="fa fa-shopping-cart" aria-hidden="true" />, route: '/on-sale', disabled: !loginDone },
										{ name: <i className="fa fa-user-secret" aria-hidden="true" />, route: '/admin', disabled: !loginDone },
										{ name: <i className="fas fa-history" />, route: '/latest' },
										{ name: <i className="fa fa-fire" aria-hidden="true" />, route: '/hot' },
										{ name: <i className="fas fa-hourglass-end" />, route: '/ending' },
										{ name: <i className="fas fa-cog" />, route: '/creator/deploy' },
										{ name: <i className="fas fa-city" />, route: '/factory', disabled: factoryInstance === undefined },
										{ name: <i className="fas fa-shopping-basket" />, route: '/minter', disabled: minterInstance === undefined }
									].map((item, index) => {
										if (!item.disabled) {
											return <div key={index} className={`col-12 py-3 rounded btn-${primaryColor}`}>
												<NavLink activeClassName={`active-${primaryColor}`} className='py-3' to={item.route} style={{ color: 'inherit', textDecoration: 'none' }}>
													{item.name}
												</NavLink>
											</div>
										}
										return <div key={index}></div>
									})}
							</div>
						}
						<div className='col'>
							<div className='col-12' style={{ height: '10vh' }}>
								{currentUserAddress && `Connected with ${currentUserAddress}!`}<br />
								<Switch>
									<SentryRoute path='/admin' component={BlockChainSwitcher} />
								</Switch>
							</div>
							<div className='col-12 mt-3 row'>
								<Switch>
									{factoryInstance && <SentryRoute exact path='/factory' component={CreatorMode} />}
									{minterInstance && <SentryRoute exact path='/minter' component={ConsumerMode} />}
									{loginDone && <SentryRoute exact path='/metadata/:contract/:product' component={FormMetadata} />}
									{loginDone && <SentryRoute path='/batch-metadata/:contract/:product' component={CreateBatchMetadata} />}
									{loginDone && <SentryRoute path='/on-sale' component={MinterMarketplace} />}
									{loginDone && <SentryRoute path='/token/:contract/:identifier' component={Token} />}
									{loginDone && <SentryRoute path='/rair/:contract/:product' component={RairProduct} />}
									{loginDone && <SentryRoute path='/creator/deploy' component={Deploy} />}
									{loginDone && <SentryRoute path='/creator/contracts' component={Contracts} />}
									{loginDone && <SentryRoute path='/creator/contract/:address/createCollection' component={ContractDetails} />}
									{loginDone && <SentryRoute path='/creator/contract/:address/listCollections' component={ContractDetails} />}

									<SentryRoute path='/all'>
										<MockUpPage primaryColor={primaryColor} textColor={textColor} />
									</SentryRoute>
									<SentryRoute path='/:adminToken/:contract/:product/:offer/:token'>
										<MockUpPage primaryColor={primaryColor} textColor={textColor} />
									</SentryRoute>
									{loginDone && <SentryRoute path='/new-factory' component={MyContracts} />}
									{loginDone && <SentryRoute exact path='/my-nft' component={MyNFTs} />}
									<SentryRoute path='/watch/:videoId/:mainManifest' component={VideoPlayer} />
									<SentryRoute path='/tokens/:contract/:product/:tokenId'>
										<MockUpPage primaryColor={primaryColor} textColor={textColor} />
									</SentryRoute>
									{adminAccess && <SentryRoute path='/admin' component={FileUpload} />}
									<SentryRoute exact path='/'>
										<div className='col-6 text-left'>
											<h1 className='w-100' style={{ textAlign: 'left' }}>
												Digital <b className='title'>Ownership</b>
												<br />
												Encryption
											</h1>
											<p className='w-100' style={{ textAlign: 'left' }}>
												RAIR is a Blockchain-based digital rights management platform that uses NFTs to gate access to streaming content
											</p>
										</div>
										{/* <div className='col-12 mt-3 row' > */}
										<MockUpPage primaryColor={primaryColor} textColor={textColor} />
									</SentryRoute>
									<SentryRoute path='/:adminToken/:contract/:product/:offer/:token'>
										<NftDataExternalLink currentUser={currentUserAddress} primaryColor={primaryColor} textColor={textColor} />
									</SentryRoute>
									{loginDone && <SentryRoute path='/new-factory' component={MyContracts} />}
									{loginDone && <SentryRoute exact path='/my-nft' component={MyNFTs} />}
									<SentryRoute path='/watch/:videoId/:mainManifest' component={VideoPlayer} />
									<SentryRoute path='/tokens/:contract/:product/:tokenId'>
										<NftDataCommonLink currentUser={currentUserAddress} primaryColor={primaryColor} textColor={textColor} />
									</SentryRoute>
									{adminAccess && <SentryRoute path='/admin'>
										<FileUpload primaryColor={primaryColor} textColor={textColor} />
									</SentryRoute>}
									<SentryRoute exact path='/'>
										<div className='col-6 text-left'>
											<h1 className='w-100' style={{ textAlign: 'left' }}>
												Digital <b className='title'>Ownership</b>
												<br />
												Encryption
											</h1>
											<p className='w-100' style={{ textAlign: 'left' }}>
												RAIR is a Blockchain-based digital rights management platform that uses NFTs to gate access to streaming content
											</p>
										</div>
										<div className='col-12 mt-3 row' >
											<MockUpPage primaryColor={primaryColor} textColor={textColor} />
										</div>
									</SentryRoute>
								</Switch>
							</div>
						</div>
					</div>
				</div>
			</Router>
		</Sentry.ErrorBoundary>
	);
}
export default App;