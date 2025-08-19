import express from "express";
import User from "../Models/user.mjs";
import bcrypt from "bcrypt";
import jwt, { decode } from "jsonwebtoken";

const generateAccessToken = (payload) => {
	const token = jwt.sign(payload, process.env.SECRET_ACCESS_KEY, {
		expiresIn: "15m",
	});
	return token;
};

const generateRefreshToken = (payload) => {
	const token = jwt.sign(payload, process.env.SECRET_REFRESH_KEY, {
		expiresIn: "7d",
	});
	return token;
};

const handleSignUp = async (req, res) => {
	const { name, email, password } = req.body;
	try {
		const existingUser = await User.findOne({ email });
		if (existingUser) {
			return res.status(400).json({ msg: "User already exists." });
		}
		const hashedPassword = await bcrypt.hash(password, 10);
		const newUser = new User({ name, email, password: hashedPassword });
		await newUser.save();
		return res.status(201).json({ msg: "Registered successfully." });
	} catch (err) {
		console.log(err);
		return res.status(500).json({ msg: "Server error" });
	}
};

const handleLogin = async (req, res) => {
	const { email, password } = req.body;
	try {
		const existingUser = await User.findOne({ email });
		if (!existingUser) {
			return res.status(404).json({ msg: "User not found." });
		}
		const isMatch = await bcrypt.compare(password, existingUser.password);
		if (!isMatch) {
			return res.status(401).json({ msg: "Incorrect Password." });
		}

		const accessToken = generateAccessToken({ id: existingUser._id, email });
		const refreshToken = generateRefreshToken({ id: existingUser._id, email });

		res.cookie("accessToken", accessToken, {
			httpOnly: true,
			sameSite: "Lax",
			secure: true,
			maxAge: 15 * 60 * 1000,
		});

		res.cookie("refreshToken", refreshToken, {
			httpOnly: true,
			sameSite: "Lax",
			secure: true,
			maxAge: 7 * 24 * 60 * 60 * 1000,
		});

		return res.status(200).json({ msg: "Logged in successfully." });
	} catch (err) {
		console.log(err);
		res.status(500).json({ msg: "Server error" });
	}
};

const handleLogout = (req, res) => {
	res.clearCookie("accessToken", {
		httpOnly: true,
		sameSite: "Lax",
		secure: true,
	});
	res.clearCookie("refreshToken", {
		httpOnly: true,
		sameSite: "Lax",
		secure: true,
	});
};

const isAuthenticated = async (req, res, next) => {
	const accessToken = req.cookies.accessToken;
	const refreshToken = req.cookies.refreshToken;

	if (accessToken) {
		try {
			const decoded = jwt.verify(accessToken, process.env.SECRET_ACCESS_KEY);
			req.user = decoded;
			return next();
		} catch (err) {
			console.log("Access token invalid or expired.");
		}
	}

	if (!refreshToken) {
		return res.status(401).json({ msg: "Unauthorized. No tokens." });
	}

	try {
		const decoded = jwt.verify(refreshToken, process.env.SECRET_REFRESH_KEY);
		req.user = decoded;

		const newAccessToken = generateAccessToken({
			id: decoded.id,
			email: decoded.email,
		});

		res.cookie("accessToken", newAccessToken, {
			httpOnly: true,
			sameSite: "Lax",
			secure: true,
			maxAge: 15 * 60 * 1000,
		});

		return next();
	} catch (err) {
		return res.status(401).json({ msg: "Unauthorized. Token refresh failed." });
	}
};

export {
	generateAccessToken,
	generateRefreshToken,
	handleSignUp,
	handleLogin,
	handleLogout,
	isAuthenticated,
};
