import React from 'react';
import { Link } from 'react-router-dom';
import PerfectScrollbar from 'react-perfect-scrollbar';
import { AppSettings } from './../../config/app-settings.js';
import SidebarProfile from './sidebar-profile.jsx';
import SidebarNav from './sidebar-nav.jsx';

class Sidebar extends React.Component {
	static contextType = AppSettings;
	
	render() {
		return (
			<AppSettings.Consumer>
				{({toggleAppSidebarMinify, toggleAppSidebarMobile, appSidebarTransparent}) => (
					<React.Fragment>
						<div id="sidebar" className={'app-sidebar ' + (appSidebarTransparent ? 'app-sidebar-transparent' : '')}>
							<PerfectScrollbar className="app-sidebar-content h-100" options={{suppressScrollX: true}}>
								<div className="menu">
									{!this.context.appSidebarSearch && (
									<SidebarProfile />
									)}
								</div>
								<SidebarNav />
								<div className="menu">
									<div className="menu-item d-flex">
										<Link to="/" className="app-sidebar-minify-btn ms-auto" onClick={toggleAppSidebarMinify}>
											<i className="fa fa-angle-double-left"></i>
										</Link>
									</div>
								</div>
							</PerfectScrollbar>
						</div>
						<div className="app-sidebar-bg"></div>
						<div className="app-sidebar-mobile-backdrop"><Link to="/" onClick={toggleAppSidebarMobile} className="stretched-link"></Link></div>
					</React.Fragment>
				)}
			</AppSettings.Consumer>
		)
	}
}

export default Sidebar;
