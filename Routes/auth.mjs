import express from "express";
import {
	handleLogin,
	handleLogout,
	handleSignUp,
	isAuthenticated,
} from "../Controllers/auth.mjs";
import User from "../Models/user.mjs";
import passport from "../Auth/passport.mjs";
import axios from "axios";

const router = express.Router();

router.post("/signup", handleSignUp);
router.post("/login", handleLogin);
router.post("/logout", handleLogout);
router.get("/isAuthenticated", isAuthenticated, (req, res) => {
	return res.status(200).json({ msg: "Already logged in." });
});
router.get("/getWords", async(req, res) => {
	try {
		const response = await axios.get("https://random-word-api.herokuapp.com/word?number=50&length=5")
		const words = response.data;
		return res.status(200).json({ words });
	} catch (error) {
		console.log("Error fetching the words", error)
		res.status(500).json({ msg: "Failed to fetch the words" });	
	}
})
router.get("/getUserInfo", isAuthenticated, async (req, res) => {
	try {
		const email = req.user.email;
		const currentUser = await User.findOne({ email }).select("-password");
		return res.status(200).json({ user: currentUser });
	} catch (err) {
		console.log(err);
		return res.status(500).json({ msg: "Server error." });
	}
});
router.get(
	"/auth/google",
	passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get(
	"/auth/google/callback",
	passport.authenticate("google", {
		session: false,
		failureRedirect: "https://type-rush-frontend.vercel.app/login",
	}),
	(req, res) => {
		const { accessToken, refreshToken } = req.user;
		res.cookie("accessToken", accessToken, {
			httpOnly: true,
			sameSite: "None",
			secure: true,
			maxAge: 15 * 60 * 1000,
		});
		res.cookie("refreshToken", refreshToken, {
			httpOnly: true,
			sameSite: "None",
			secure: true,
			maxAge: 7 * 24 * 60 * 60 * 1000,
		});
		res.redirect("https://type-rush-frontend.vercel.app/play");
	}
);

export default router;
