/*
 * jQuery Galleriffic plugin
 *
 * Copyright (c) 2008 Trent Foley (http://trentacular.com)
 * Licensed under the MIT License:
 *   http://www.opensource.org/licenses/mit-license.php
 *
 * Much thanks to primary contributer Ponticlaro (http://www.ponticlaro.com)
 */
;(function($) {

	// Hide elements with the noscript class
	$('.noscript').hide();

	var ver = 'galleriffic-1.1';
	var galleryOffset = 0;
	var galleries = [];
	var allImages = [];

	$.galleriffic = {
		goto: function(hash) {
			hash = getHashFromString(hash);
			var gallery = getGalleryForHash(hash);
			if (!gallery) return;

			var index = hash-gallery.offset;
			gallery.goto(index);
		}
	};

	function getGalleryForHash(hash) {
		for (i = 0; i < galleries.length; i++) {
			var gallery = galleries[i];
			if (hash < (gallery.data.length+gallery.offset))
				return gallery;
		}
		return 0;
	}

	function getHashFromString(hash) {
		if (typeof hash == 'number')
			return hash;
		
		if (!hash) return -1;
		
		hash = hash.replace(/^.*#/, '');

		if (isNaN(hash)) return -1;
		return (+hash);
	}

	function registerGallery(gallery) {
		galleries.push(gallery);

		// update the global offset value
		galleryOffset += gallery.data.length;
	}	

	var defaults = {
		delay:                     3000,
		numThumbs:                 20,
		preloadAhead:              40, // Set to -1 to preload all images
		enableTopPager:            false,
		enableBottomPager:         true,
		maxPagesToShow:            7,
		imageContainerSel:         '',
		captionContainerSel:       '',
		controlsContainerSel:      '',
		loadingContainerSel:       '',
		renderSSControls:          true,
		renderNavControls:         true,
		playLinkText:              'Play',
		pauseLinkText:             'Pause',
		prevLinkText:              'Previous',
		nextLinkText:              'Next',
		nextPageLinkText:          'Next &rsaquo;',
		prevPageLinkText:          '&lsaquo; Prev',
		enableHistory:             false,
		autoStart:                 false,
		syncTransitions:           false,
		defaultTransitionDuration: 1000,
		onSlideChange:             undefined, // accepts a delegate like such: function(prevIndex, nextIndex) { ... }
		onTransitionOut:           undefined, // accepts a delegate like such: function(slide, caption, isSync, callback) { ... }
		onTransitionIn:            undefined, // accepts a delegate like such: function(slide, caption, isSync) { ... }
		onPageTransitionOut:       undefined, // accepts a delegate like such: function(callback) { ... }
		onPageTransitionIn:        undefined  // accepts a delegate like such: function() { ... }
	};

	$.fn.galleriffic = function(thumbsContainerSel, settings) {
		//  Extend Gallery Object
		$.extend(this, {
			ver: function() {
				return ver;
			},

			getIndex: function(hash) {
				return hash-this.offset;
			},

			clickHandler: function(e, link) {
				this.pause();

				if (!this.enableHistory) {
					var hash = getHashFromString(link.href);
					if (hash >= 0) {
						var index = this.getIndex(hash);
						if (index >= 0)
							this.goto(index);
					}
					e.preventDefault();
				}
			},

			initializeThumbs: function() {
				this.data = [];
				var gallery = this;
				
				this.$thumbsContainer.find('ul.thumbs > li').each(function(i) {
					var $li = $(this);
					var $aThumb = $li.find('a.thumb');
					var hash = gallery.offset+i;

					gallery.data.push({
						title:$aThumb.attr('title'),
						slideUrl:$aThumb.attr('href'),
						caption:$li.find('.caption').remove(),
						hash:hash
					});

					// Setup attributes and click event handler
					$aThumb.attr('rel', 'history')
						.attr('href', '#'+hash)
						.click(function(e) {
							gallery.clickHandler(e, this);
						});
				});
				return this;
			},

			isPreloadComplete: false,

			preloadInit: function() {
				if (this.preloadAhead == 0) return this;
				
				this.preloadStartIndex = this.currentIndex;
				var nextIndex = this.getNextIndex(this.preloadStartIndex);
				return this.preloadRecursive(this.preloadStartIndex, nextIndex);
			},
			
			preloadRelocate: function(index) {
				// By changing this startIndex, the current preload script will restart
				this.preloadStartIndex = index;
				return this;
			},

			preloadRecursive: function(startIndex, currentIndex) {
				// Check if startIndex has been relocated
				if (startIndex != this.preloadStartIndex) {
					var nextIndex = this.getNextIndex(this.preloadStartIndex);
					return this.preloadRecursive(this.preloadStartIndex, nextIndex);
				}

				var gallery = this;

				// Now check for preloadAhead count
				var preloadCount = currentIndex - startIndex;
				if (preloadCount < 0)
					preloadCount = this.data.length-1-startIndex+currentIndex;
				if (this.preloadAhead >= 0 && preloadCount > this.preloadAhead) {
					// Do this in order to keep checking for relocated start index
					setTimeout(function() { gallery.preloadRecursive(startIndex, currentIndex); }, 500);
					return this;
				}

				var imageData = this.data[currentIndex];
				if (!imageData)
					return this;

				// If already loaded, continue
				if (imageData.image)
					return this.preloadNext(startIndex, currentIndex); 
				
				// Preload the image
				var image = new Image();
				
				image.onload = function() {
					imageData.image = this;
					gallery.preloadNext(startIndex, currentIndex);
				};

				image.alt = imageData.title;
				image.src = imageData.slideUrl;

				return this;
			},
			
			preloadNext: function(startIndex, currentIndex) {
				var nextIndex = this.getNextIndex(currentIndex);
				if (nextIndex == startIndex) {
					this.isPreloadComplete = true;
				} else {
					// Use setTimeout to free up thread
					var gallery = this;
					setTimeout(function() { gallery.preloadRecursive(startIndex, nextIndex); }, 100);
				}
				return this;
			},

			getNextIndex: function(index) {
				var nextIndex = index+1;
				if (nextIndex >= this.data.length)
					nextIndex = 0;
				return nextIndex;
			},
			
			getPrevIndex: function(index) {
				var prevIndex = index-1;
				if (prevIndex < 0)
					prevIndex = this.data.length-1;
				return prevIndex;
			},

			pause: function() {
				if (this.interval)
					this.toggleSlideshow();
				
				return this;
			},

			play: function() {
				if (!this.interval)
					this.toggleSlideshow();
				
				return this;
			},

			toggleSlideshow: function() {
				if (this.interval) {
					clearInterval(this.interval);
					this.interval = 0;
					
					if (this.$controlsContainer) {
						this.$controlsContainer
							.find('div.ss-controls a').removeClass().addClass('play')
							.attr('title', this.playLinkText)
							.attr('href', '#play')
							.html(this.playLinkText);
					}
				} else {
					var gallery = this;
					this.interval = setInterval(function() {
						gallery.ssAdvance();
					}, this.delay);
					
					if (this.$controlsContainer) {
						this.$controlsContainer
							.find('div.ss-controls a').removeClass().addClass('pause')
							.attr('title', this.pauseLinkText)
							.attr('href', '#pause')
							.html(this.pauseLinkText);
					}
				}

				return this;
			},

			ssAdvance: function() {
				var nextIndex = this.getNextIndex(this.currentIndex);
				var nextHash = this.data[nextIndex].hash;

				// Seems to be working on both FF and Safari
				if (this.enableHistory)
					$.historyLoad(String(nextHash));  // At the moment, historyLoad only accepts string arguments
				else
					this.goto(nextIndex);

				return this;
			},

			next: function() {
				this.pause();
				goto(this.getNextIndex(this.currentIndex));
			},

			previous: function() {
				this.pause();
				goto(this.getPrevIndex(this.currentIndex));
			},

			goto: function(index) {
				if (index < 0) index = 0;
				else if (index >= this.data.length) index = this.data.length-1;
				
				if (this.onSlideChange)
					this.onSlideChange(this.currentIndex, index);
				
				this.currentIndex = index;
				this.preloadRelocate(index);
				return this.refresh();
			},
			
			getDefaultTransitionDuration: function(isSync) {
				if (isSync)
					return this.defaultTransitionDuration;
				return this.defaultTransitionDuration / 2;
			},
			
			refresh: function() {
				var imageData = this.data[this.currentIndex];
				if (!imageData)
					return this;

				// Update Controls
				if (this.$controlsContainer) {
					this.$controlsContainer
						.find('div.nav-controls a.prev').attr('href', '#'+this.data[this.getPrevIndex(this.currentIndex)].hash).end()
						.find('div.nav-controls a.next').attr('href', '#'+this.data[this.getNextIndex(this.currentIndex)].hash);
				}

				var previousSlide = this.$imageContainer.find('span.current').addClass('previous').removeClass('current');
				var previousCaption = 0;

				if (this.$captionContainer) {
					previousCaption = this.$captionContainer.find('span.current').addClass('previous').removeClass('current');
				}

				// Perform transitions simultaneously if syncTransitions is true and the next image is already preloaded
				var isSync = this.syncTransitions && imageData.image;
				
				// Flag we are transitioning
				var isTransitioning = true;
				var gallery = this;

				var transitionOutCallback = function() {
					// Flag that the transition has completed
					isTransitioning = false;

					// Remove the old slide
					previousSlide.remove();

					// Remove old caption
					if (previousCaption)
						previousCaption.remove();

					if (!isSync)
					{
						if (imageData.image && imageData.hash == gallery.data[gallery.currentIndex].hash) {
							gallery.buildImage(imageData, isSync);
						} else {
							// Show loading container
							if (gallery.$loadingContainer) {
								gallery.$loadingContainer.show();
							}
						}
					}
				};

				if (previousSlide.length == 0) {
					// For the first slide, the previous slide will be empty, so we will call the callback immediately
					transitionOutCallback();
				} else {
					if (this.onTransitionOut) {
						this.onTransitionOut(previousSlide, previousCaption, isSync, transitionOutCallback);
					} else {
						previousSlide.fadeTo(this.getDefaultTransitionDuration(isSync), 0.0, transitionOutCallback);
						if (previousCaption)
							previousCaption.fadeTo(this.getDefaultTransitionDuration(isSync), 0.0);
					}
				}

				// Go ahead and begin transition in of next image
				if (isSync)
					this.buildImage(imageData, isSync);
			
				if (!imageData.image) {
					var image = new Image();
					
					// Wire up mainImage onload event
					image.onload = function() {
						imageData.image = this;

						// Only build image if the out transition has completed and we are still on the same image hash
						if (!isTransitioning && imageData.hash == gallery.data[gallery.currentIndex].hash) {
							gallery.buildImage(imageData, isSync);
						}
					};

					// set alt and src
					image.alt = imageData.title;
					image.src = imageData.slideUrl;
				}

				// This causes the preloader (if still running) to relocate out from the currentIndex
				this.relocatePreload = true;

				return this.syncThumbs();
			},
			
			buildImage: function(imageData, isSync) {
				var gallery = this;
				var nextIndex = this.getNextIndex(this.currentIndex);

				// Construct new hidden span for the image
				var newSlide = this.$imageContainer
					.append('<span class="image-wrapper current"><a class="advance-link" rel="history" href="#'+this.data[nextIndex].hash+'" title="'+imageData.title+'">&nbsp;</a></span>')
					.find('span.current').css('opacity', '0');
				
				newSlide.find('a')
					.append(imageData.image)
					.click(function(e) {
						gallery.clickHandler(e, this);
					});
				
				var newCaption = 0;
				if (this.$captionContainer) {
					// Construct new hidden caption for the image
					newCaption = this.$captionContainer
						.append('<span class="image-caption current"></span>')
						.find('span.current').css('opacity', '0')
						.append(imageData.caption);
				}

				// Hide the loading conatiner
				if (this.$loadingContainer) {
					this.$loadingContainer.hide();
				}

				// Transition in the new image
				if (this.onTransitionIn) {
					this.onTransitionIn(newSlide, newCaption, isSync);
				} else {
					newSlide.fadeTo(this.getDefaultTransitionDuration(isSync), 1.0);
					if (newCaption)
						newCaption.fadeTo(this.getDefaultTransitionDuration(isSync), 1.0);
				}

				return this;
			},

			syncThumbs: function() {
				if (this.$thumbsContainer) {
					var page = Math.floor(this.currentIndex / this.numThumbs);
					if (page != this.currentPage) {
						this.currentPage = page;
						this.updateThumbs();
					}

					// Remove existing selected class and add selected class to new thumb
					var $thumbs = this.$thumbsContainer.find('ul.thumbs').children();
					$thumbs.filter('.selected').removeClass('selected');
					$thumbs.eq(this.currentIndex).addClass('selected');
				}

				return this;
			},

			updateThumbs: function() {
				var gallery = this;
				var transitionOutCallback = function() {
					gallery.rebuildThumbs();

					// Transition In the thumbsContainer
					if (gallery.onPageTransitionIn)
						gallery.onPageTransitionIn();
					else
						gallery.$thumbsContainer.show();
				};

				// Transition Out the thumbsContainer
				if (this.onPageTransitionOut) {
					this.onPageTransitionOut(transitionOutCallback);
				} else {
					this.$thumbsContainer.hide();
					transitionOutCallback();
				}

				return this;
			},

			rebuildThumbs: function() {
				// Initialize currentPage to first page
				if (this.currentPage < 0)
					this.currentPage = 0;
				
				var needsPagination = this.data.length > this.numThumbs;

				// Rebuild top pager
				var $topPager = this.$thumbsContainer.find('div.top');
				if ($topPager.length == 0)
					$topPager = this.$thumbsContainer.prepend('<div class="top pagination"></div>').find('div.top');

				if (needsPagination && this.enableTopPager) {
					$topPager.empty();
					this.buildPager($topPager);
				}

				// Rebuild bottom pager
				if (needsPagination && this.enableBottomPager) {
					var $bottomPager = this.$thumbsContainer.find('div.bottom');
					if ($bottomPager.length == 0)
						$bottomPager = this.$thumbsContainer.append('<div class="bottom pagination"></div>').find('div.bottom');
					else
						$bottomPager.empty();

					this.buildPager($bottomPager);
				}

				var startIndex = this.currentPage*this.numThumbs;
				var stopIndex = startIndex+this.numThumbs-1;
				if (stopIndex >= this.data.length)
					stopIndex = this.data.length-1;

				// Show/Hide thumbs
				var $thumbsUl = this.$thumbsContainer.find('ul.thumbs');
				$thumbsUl.find('li').each(function(i) {
					var $li = $(this);
					if (i >= startIndex && i <= stopIndex) {
						$li.show();
					} else {
						$li.hide();
					}
				});

				// Remove the noscript class from the thumbs container ul
				$thumbsUl.removeClass('noscript');
				
				return this;
			},

			buildPager: function(pager) {
				var gallery = this;
				var startIndex = this.currentPage*this.numThumbs;
				var pagesRemaining = this.maxPagesToShow - 1;
				
				var pageNum = this.currentPage - Math.floor((this.maxPagesToShow - 1) / 2) + 1;
				if (pageNum > 0) {
					var remainingPageCount = this.numPages - pageNum;
					if (remainingPageCount < pagesRemaining) {
						pageNum = pageNum - (pagesRemaining - remainingPageCount);
					}
				}

				if (pageNum < 0) {
					pageNum = 0;
				}

				// Prev Page Link
				if (this.currentPage > 0) {
					var prevPage = startIndex - this.numThumbs;
					pager.append('<a rel="history" href="#'+this.data[prevPage].hash+'" title="'+this.prevPageLinkText+'">'+this.prevPageLinkText+'</a>');
				}

				// Create First Page link if needed
				if (pageNum > 0) {
					this.buildPageLink(pager, 0);
					if (pageNum > 1)
						pager.append('<span class="ellipsis">&hellip;</span>');
					
					pagesRemaining--;
				}

				// Page Index Links
				while (pagesRemaining > 0) {
					this.buildPageLink(pager, pageNum);
					pagesRemaining--;
					pageNum++;
				}

				// Create Last Page link if needed
				if (pageNum < this.numPages) {
					var lastPageNum = this.numPages - 1;
					if (pageNum < lastPageNum)
						pager.append('<span class="ellipsis">&hellip;</span>');

					this.buildPageLink(pager, lastPageNum);
				}

				// Next Page Link
				var nextPage = startIndex+this.numThumbs;
				if (nextPage < this.data.length) {
					pager.append('<a rel="history" href="#'+this.data[nextPage].hash+'" title="'+this.nextPageLinkText+'">'+this.nextPageLinkText+'</a>');
				}

				pager.find('a').click(function(e) {
					gallery.clickHandler(e, this);
				});

				return this;
			},
			
			buildPageLink: function(pager, pageNum) {
				var pageLabel = pageNum + 1;

				if (pageNum == this.currentPage)
					pager.append('<span class="current">'+pageLabel+'</span>');
				else if (pageNum < this.numPages) {
					var imageIndex = pageNum*this.numThumbs;
					pager.append('<a rel="history" href="#'+this.data[imageIndex].hash+'" title="'+pageLabel+'">'+pageLabel+'</a>');
				}
			}
		});

		// Now initialize the gallery
		$.extend(this, defaults, settings);

		if (this.interval)
			clearInterval(this.interval);

		this.interval = 0;
		
		// Verify the history plugin is available
		if (this.enableHistory && !$.historyInit)
			this.enableHistory = false;
		
		// Select containers
		if (this.imageContainerSel) this.$imageContainer = $(this.imageContainerSel);
		if (this.captionContainerSel) this.$captionContainer = $(this.captionContainerSel);
		if (this.loadingContainerSel) this.$loadingContainer = $(this.loadingContainerSel);

		// Setup the jQuery object holding each container that will be transitioned
		this.$transitionContainers = $([]);
		if (this.$imageContainer)
			this.$transitionContainers = this.$transitionContainers.add(this.$imageContainer);
		if (this.$captionContainer)
			this.$transitionContainers = this.$transitionContainers.add(this.$captionContainer);
		
		// Set the hash index offset for this gallery
		this.offset = galleryOffset;

		this.$thumbsContainer = $(thumbsContainerSel);
		this.initializeThumbs();

		// Add this gallery to the global galleries array
		registerGallery(this);

		this.numPages = Math.ceil(this.data.length/this.numThumbs);
		
		if (this.maxPagesToShow < 3)
			this.maxPagesToShow = 3;

		this.currentPage = -1;
		this.currentIndex = 0;
		var gallery = this;

		// Hide the loadingContainer
		if (this.$loadingContainer)
			this.$loadingContainer.hide();

		// Setup controls
		if (this.controlsContainerSel) {
			this.$controlsContainer = $(this.controlsContainerSel).empty();
			
			if (this.renderSSControls) {
				if (this.autoStart) {
					this.$controlsContainer
						.append('<div class="ss-controls"><a href="#pause" class="pause" title="'+this.pauseLinkText+'">'+this.pauseLinkText+'</a></div>');
				} else {
					this.$controlsContainer
						.append('<div class="ss-controls"><a href="#play" class="play" title="'+this.playLinkText+'">'+this.playLinkText+'</a></div>');
				}

				this.$controlsContainer.find('div.ss-controls a')
					.click(function(e) {
						gallery.toggleSlideshow();
						e.preventDefault();
						return false;
					});
			}
		
			if (this.renderNavControls) {
				this.$controlsContainer
					.append('<div class="nav-controls"><a class="prev" rel="history" title="'+this.prevLinkText+'">'+this.prevLinkText+'</a><a class="next" rel="history" title="'+this.nextLinkText+'">'+this.nextLinkText+'</a></div>')
					.find('div.nav-controls a')
					.click(function(e) {
						gallery.clickHandler(e, this);
					});
			}
		}

		// Setup gallery to show the first image
		if (!this.enableHistory || !location.hash) {
			this.goto(0);
		}

		if (this.autoStart) {
			setTimeout(function() { gallery.play(); }, this.delay);
		}

		// Kickoff Image Preloader after 1 second
		setTimeout(function() { gallery.preloadInit(); }, 1000);

		return this;
	};
})(jQuery);
