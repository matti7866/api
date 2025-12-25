import React from 'react';
import { Link } from 'react-router-dom';
import { AppSettings } from './../../config/app-settings.js';

class SidebarProfile extends React.Component {

	constructor(props) {
		super(props);
		this.state = {
			profileActive: 0
		};
		this.handleProfileExpand = this.handleProfileExpand.bind(this);
	}

	handleProfileExpand(e) {
		e.preventDefault();
		this.setState(state => ({
			profileActive: !this.state.profileActive,
		}));
	}
  
	render() {
		return (
			<AppSettings.Consumer>
				{({appSidebarMinify}) => (
					<div>
						<div className={"menu-profile " + (this.state.profileActive ? "expand " : "")}>
							<Link to="/" onClick={this.handleProfileExpand} className="menu-profile-link">
								<div className="menu-profile-cover with-shadow"></div>
								<div className="menu-profile-image">
									<img src="../assets/img/user/user-13.jpg" alt="" />
								</div>
								<div className="menu-profile-info">
									<div className="d-flex align-items-center">
										<div className="flex-grow-1">
											Sean Ngu
										</div>
										<div className="menu-caret ms-auto"></div>
									</div>
									<small>Front end developer</small>
								</div>
							</Link>
						</div>
						<div className={"collapse " + (this.state.profileActive && !appSidebarMinify ? "show " : "")}>
							<div className="menu-item pt-5px">
								<Link to="/" className="menu-link">
									<div className="menu-icon"><i className="fa fa-cog"></i></div>
									<div className="menu-text">Settings</div>
								</Link>
							</div>
							<div className="menu-item">
								<Link to="/" className="menu-link">
									<div className="menu-icon"><i className="fa fa-pencil-alt"></i></div>
									<div className="menu-text"> Send Feedback</div>
								</Link>
							</div>
							<div className="menu-item pb-5px">
								<Link to="/" className="menu-link">
									<div className="menu-icon"><i className="fa fa-question-circle"></i></div>
									<div className="menu-text"> Helps</div>
								</Link>
							</div>
							<div className="menu-divider m-0"></div>
						</div>
					</div>
				)}
			</AppSettings.Consumer>
		)
	}
}

export default SidebarProfile;